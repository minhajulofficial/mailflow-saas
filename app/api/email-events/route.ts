import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isAuthorizedWorker } from "@/lib/worker-auth";
import { createAuditLog } from "@/lib/audit";

/**
 * Internal endpoint for recording email events. Only the background worker may
 * call it with the shared worker secret, otherwise anyone could forge send or
 * bounce events.
 */
export async function POST(request: Request) {
  if (!isAuthorizedWorker(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { emailJobId, type, meta } = body || {};
  if (!emailJobId || !type || typeof type !== "string") {
    return NextResponse.json(
      { error: "emailJobId and type are required" },
      { status: 400 }
    );
  }

  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("email_events")
    .select("id")
    .eq("email_job_id", emailJobId)
    .eq("type", type)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const { data: event, error } = await supabase
    .from("email_events")
    .insert({ email_job_id: emailJobId, type, meta: meta || {} })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const { data: job } = await supabase
    .from("email_jobs")
    .select("*, leads(email, user_id), campaigns(user_id)")
    .eq("id", emailJobId)
    .maybeSingle();

  if (type === "sent") {
    await supabase
      .from("email_jobs")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", emailJobId);
    await createAuditLog(job?.campaigns?.user_id, "email_sent", {
      jobId: emailJobId,
    });
  }

  if (type === "bounce" || type === "spam" || type === "unsub") {
    if (job?.leads?.email) {
      await supabase.from("suppression_list").upsert(
        {
          user_id: job.leads.user_id,
          email: job.leads.email,
          reason: type,
        },
        { onConflict: "user_id,email" }
      );
    }
    await supabase
      .from("email_jobs")
      .update({ status: "failed", error: type })
      .eq("id", emailJobId);
  }

  return NextResponse.json(event);
}
