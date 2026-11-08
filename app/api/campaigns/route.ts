import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().trim().min(1, "Campaign name is required").max(200),
  status: z.enum(["draft", "scheduled", "sending", "paused", "completed", "cancelled"]).optional(),
  senderIds: z.array(z.string().uuid()).optional(),
  recipientFilter: z.record(z.string(), z.any()).optional(),
  schedule: z.record(z.string(), z.any()).optional(),
});

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // `campaigns.sender_ids` is a uuid[] column, so there is no PostgREST
  // relationship to embed `sender_accounts` through. Embedding it made the
  // whole request fail with a 400 and left the dashboard/campaigns page empty.
  const { data, error } = await supabase
    .from("campaigns")
    .select("*, campaign_steps(*)")
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
      { error: parsed.error.issues[0]?.message || "Invalid campaign" },
      { status: 400 }
    );
  }

  const { name, status, senderIds, recipientFilter, schedule } = parsed.data;

  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      user_id: user.id,
      name,
      status: status ?? "draft",
      sender_ids: senderIds ?? [],
      recipient_filter: recipientFilter ?? null,
      schedule: schedule ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
