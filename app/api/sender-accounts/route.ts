import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";

const createSchema = z.object({
  from_name: z.string().trim().min(1, "From name is required").max(120),
  from_email: z.string().trim().email("A valid from email is required"),
  reply_to: z.string().trim().email("Reply-to must be a valid email").optional().or(z.literal("")),
  signature: z.string().max(4000).optional(),
  integration_id: z.string().uuid().nullable().optional(),
  daily_limit: z.number().int().min(1).max(2000).optional(),
  hourly_limit: z.number().int().min(1).max(500).optional(),
  min_delay: z.number().int().min(0).max(3600).optional(),
  max_delay: z.number().int().min(0).max(3600).optional(),
});

const updateSchema = createSchema.partial().extend({
  enabled: z.boolean().optional(),
});

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("sender_accounts")
    .select("*, integrations(id, provider, label, status, enabled)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid sender account" },
      { status: 400 }
    );
  }

  if (parsed.data.integration_id) {
    const { data: integration } = await supabase
      .from("integrations")
      .select("id")
      .eq("id", parsed.data.integration_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!integration) {
      return NextResponse.json(
        { error: "That integration does not belong to you" },
        { status: 400 }
      );
    }
  }

  const { data, error } = await supabase
    .from("sender_accounts")
    .insert({
      ...parsed.data,
      reply_to: parsed.data.reply_to || null,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await createAuditLog(user.id, "sender_account_created", {
    senderId: data.id,
    fromEmail: data.from_email,
  });

  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { id, ...rest } = body || {};
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Sender id is required" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(rest);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid sender account" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("sender_accounts")
    .update(parsed.data)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Sender id is required" }, { status: 400 });

  const { error } = await supabase
    .from("sender_accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
