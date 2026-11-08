import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createAuditLog } from "@/lib/audit";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe-token";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");
  const token = request.nextUrl.searchParams.get("token");
  const jobId = request.nextUrl.searchParams.get("jobId");

  if (!email) {
    return new Response("Missing email", { status: 400 });
  }

  // Fail closed: only honour links we signed ourselves.
  if (!verifyUnsubscribeToken(email, jobId, token)) {
    return NextResponse.redirect(
      `${request.nextUrl.origin}/unsubscribed?email=${encodeURIComponent(
        email
      )}&invalid=1`
    );
  }

  const supabase = createServiceClient();

  let ownerIds: string[] = [];
  let leadIds: string[] = [];

  if (jobId) {
    const { data: job } = await supabase
      .from("email_jobs")
      .select("id, lead_id, leads(id, user_id, email), campaigns(user_id)")
      .eq("id", jobId)
      .maybeSingle();

    const jobLead = (job as any)?.leads;
    if (jobLead?.user_id) {
      ownerIds = [jobLead.user_id];
      leadIds = [jobLead.id];
    } else if ((job as any)?.campaigns?.user_id) {
      ownerIds = [(job as any).campaigns.user_id];
      if ((job as any).lead_id) leadIds = [(job as any).lead_id];
    }
  }

  if (ownerIds.length === 0) {
    const { data: leads } = await supabase
      .from("leads")
      .select("id, user_id")
      .eq("email", email);
    ownerIds = Array.from(
      new Set(((leads || []) as any[]).map((l) => l.user_id).filter(Boolean))
    );
    leadIds = ((leads || []) as any[]).map((l) => l.id);
  }

  for (const userId of ownerIds) {
    await supabase.from("suppression_list").upsert(
      { user_id: userId, email: email.trim().toLowerCase(), reason: "unsub" },
      { onConflict: "user_id,email" }
    );
  }

  if (leadIds.length > 0) {
    await supabase
      .from("email_jobs")
      .update({ status: "failed", error: "unsubscribed" })
      .in("lead_id", leadIds)
      .eq("status", "scheduled");
  }

  if (jobId) {
    await supabase.from("email_events").insert({
      email_job_id: jobId,
      type: "unsub",
      meta: { email },
    });
  }

  for (const userId of ownerIds) {
    await createAuditLog(userId, "lead_unsubscribed", { email, jobId });
  }

  return NextResponse.redirect(
    `${request.nextUrl.origin}/unsubscribed?email=${encodeURIComponent(email)}`
  );
}
