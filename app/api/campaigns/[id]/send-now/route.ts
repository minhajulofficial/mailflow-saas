import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { processDueEmailJobs } from "@/lib/process-email-jobs";

/**
 * Processes a small batch of this campaign's due emails immediately, so users
 * do not need to wait for the background worker (useful on Vercel Hobby where
 * cron can only run once a day).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const appUrl = process.env.APP_URL || new URL(request.url).origin;

  try {
    await supabase
      .from("campaigns")
      .update({ status: "sending" })
      .eq("id", id)
      .eq("status", "scheduled");

    const result = await processDueEmailJobs({
      limit: 10,
      campaignId: id,
      appUrl,
    });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Could not send emails" },
      { status: 500 }
    );
  }
}
