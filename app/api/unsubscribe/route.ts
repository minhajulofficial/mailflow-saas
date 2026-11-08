import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createAuditLog } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");
  const token = request.nextUrl.searchParams.get("token");
  const jobId = request.nextUrl.searchParams.get("jobId");

  if (!email) {
    return new Response("Missing email", { status: 400 });
  }

  const supabase = createServiceClient();

  // Find the lead to get user_id
  const { data: lead } = await supabase
    .from("leads")
    .select("id, user_id")
    .eq("email", email)
    .maybeSingle();

  if (lead) {
    // Add to suppression list
    await supabase.from("suppression_list").upsert({
      user_id: lead.user_id,
      email,
      reason: "unsub",
      created_at: new Date().toISOString(),
    }, { onConflict: "user_id,email" });

    // Update any scheduled email jobs for this lead to failed/suppressed
    await supabase
      .from("email_jobs")
      .update({ status: "failed", error: "unsubscribed" })
      .eq("lead_id", lead.id)
      .eq("status", "scheduled");

    await createAuditLog(lead.user_id, "lead_unsubscribed", { leadId: lead.id, email, jobId });
  }

  // Record unsubscribe event if we have a job
  if (jobId) {
    await supabase.from("email_events").insert({
      email_job_id: jobId,
      type: "unsub",
      meta: { email, token },
    });
  }

  return NextResponse.redirect(`${request.nextUrl.origin}/unsubscribed?email=${encodeURIComponent(email)}`);
}
