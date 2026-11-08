import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().trim().min(1, "List name is required").max(120),
});

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [{ data: lists, error }, { data: leads }] = await Promise.all([
    supabase
      .from("lead_lists")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("leads")
      .select("list_id, email")
      .eq("user_id", user.id),
  ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const counts = new Map<string, { total: number; withEmail: number }>();
  for (const lead of leads || []) {
    const key = lead.list_id || "__none__";
    const entry = counts.get(key) || { total: 0, withEmail: 0 };
    entry.total += 1;
    if (lead.email) entry.withEmail += 1;
    counts.set(key, entry);
  }

  const withCounts = (lists || []).map((list) => ({
    ...list,
    lead_count: counts.get(list.id)?.total || 0,
    email_count: counts.get(list.id)?.withEmail || 0,
  }));

  return NextResponse.json(withCounts);
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
      { error: parsed.error.issues[0]?.message || "Invalid list" },
      { status: 400 }
    );
  }

  const { data: existing } = await supabase
    .from("lead_lists")
    .select("id")
    .eq("user_id", user.id)
    .eq("name", parsed.data.name)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "A list with that name already exists" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("lead_lists")
    .insert({ user_id: user.id, name: parsed.data.name })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "List id is required" }, { status: 400 });

  const { error } = await supabase
    .from("lead_lists")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
