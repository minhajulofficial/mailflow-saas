import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  status: z
    .enum(["draft", "scheduled", "sending", "paused", "completed", "cancelled"])
    .optional(),
});

async function loadCampaign(id: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return {
      error: NextResponse.json({ error: error.message }, { status: 400 }),
    } as const;
  }
  if (!campaign) {
    return {
      error: NextResponse.json({ error: "Campaign not found" }, { status: 404 }),
    } as const;
  }

  return { supabase, user, campaign } as const;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const loaded = await loadCampaign(id);
  if ("error" in loaded) return loaded.error;

  const { supabase, campaign } = loaded;

  const [{ data: steps }, { data: jobs }] = await Promise.all([
    supabase
      .from("campaign_steps")
      .select("*, templates(id, name, subject, body_html)")
      .eq("campaign_id", id)
      .order("step_no", { ascending: true }),
    supabase
      .from("email_jobs")
      .select("id, status, scheduled_at, sent_at, error, lead_id, leads(person_name, email)")
      .eq("campaign_id", id)
      .order("scheduled_at", { ascending: false })
      .limit(200),
  ]);

  const counts = { total: 0, scheduled: 0, sent: 0, failed: 0 };
  for (const job of jobs || []) {
    counts.total++;
    if (job.status === "sent") counts.sent++;
    else if (job.status === "failed") counts.failed++;
    else counts.scheduled++;
  }

  return NextResponse.json({ ...campaign, steps: steps || [], jobs: jobs || [], counts });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const loaded = await loadCampaign(id);
  if ("error" in loaded) return loaded.error;
  const { supabase } = loaded;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid campaign" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("campaigns")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const loaded = await loadCampaign(id);
  if ("error" in loaded) return loaded.error;
  const { supabase } = loaded;

  const { error } = await supabase.from("campaigns").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
