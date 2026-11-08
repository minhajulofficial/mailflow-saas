import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GDPR data export: returns everything MailFlow stores for the signed-in user
 * as a downloadable JSON file. Secrets/API keys are never included.
 */
export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [profile, leads, lists, campaigns, templates, senders, replies] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
    supabase.from("leads").select("*").eq("user_id", user.id),
    supabase.from("lead_lists").select("*").eq("user_id", user.id),
    supabase.from("campaigns").select("*").eq("user_id", user.id),
    supabase.from("templates").select("*").eq("user_id", user.id),
    supabase.from("sender_accounts").select("*").eq("user_id", user.id),
    supabase.from("replies").select("*").eq("user_id", user.id),
  ]);

  const campaignIds = (campaigns.data ?? []).map((c) => c.id);

  let steps: any[] = [];
  let jobs: any[] = [];
  let events: any[] = [];

  if (campaignIds.length > 0) {
    const [stepsRes, jobsRes] = await Promise.all([
      supabase.from("campaign_steps").select("*").in("campaign_id", campaignIds),
      supabase.from("email_jobs").select("*").in("campaign_id", campaignIds),
    ]);
    steps = stepsRes.data ?? [];
    jobs = jobsRes.data ?? [];

    const jobIds = jobs.map((j) => j.id);
    if (jobIds.length > 0) {
      const { data } = await supabase
        .from("email_events")
        .select("*")
        .in("email_job_id", jobIds);
      events = data ?? [];
    }
  }

  const payload = {
    exported_at: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
    },
    profile: profile.data ?? null,
    lead_lists: lists.data ?? [],
    leads: leads.data ?? [],
    templates: templates.data ?? [],
    sender_accounts: senders.data ?? [],
    campaigns: campaigns.data ?? [],
    campaign_steps: steps,
    email_jobs: jobs,
    replies: replies.data ?? [],
    email_events: events,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="mailflow-export-${new Date()
        .toISOString()
        .slice(0, 10)}.json"`,
    },
  });
}
