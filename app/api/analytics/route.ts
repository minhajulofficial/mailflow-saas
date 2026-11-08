export const dynamic = "force-dynamic";

import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Returns the signed-in user's email events only. Previously this used the
 * service-role key without any filter, which leaked every tenant's data.
 */
export async function GET() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: campaigns, error: campaignsError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("user_id", user.id);

  if (campaignsError) {
    return NextResponse.json({ error: campaignsError.message }, { status: 400 });
  }

  const campaignIds = (campaigns || []).map((c) => c.id);
  if (campaignIds.length === 0) {
    return NextResponse.json([]);
  }

  const { data: jobs, error: jobsError } = await supabase
    .from("email_jobs")
    .select("id")
    .in("campaign_id", campaignIds);

  if (jobsError) {
    return NextResponse.json({ error: jobsError.message }, { status: 400 });
  }

  const jobIds = (jobs || []).map((j) => j.id);
  if (jobIds.length === 0) {
    return NextResponse.json([]);
  }

  const { data, error } = await supabase
    .from("email_events")
    .select("*, email_jobs(campaign_id, lead_id)")
    .in("email_job_id", jobIds)
    .order("occurred_at", { ascending: false })
    .limit(1000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data || []);
}
