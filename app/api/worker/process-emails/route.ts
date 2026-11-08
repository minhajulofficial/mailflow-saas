import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import { isAuthorizedWorker } from "@/lib/worker-auth";
import { dispatchEmail } from "@/lib/email-provider";
import { decryptSecret } from "@/lib/encryption";
import { createAuditLog } from "@/lib/audit";
import { signUnsubscribeToken } from "@/lib/unsubscribe-token";
import { injectTracking } from "@/lib/tracking";

const MAX_BATCH = 50;

/**
 * Background worker endpoint: processes due email jobs.
 * Called by Vercel Cron, Inngest, Trigger.dev, or an external scheduler.
 * Requires Bearer WORKER_API_SECRET authorization.
 */
export async function POST(request: Request) {
  if (!isAuthorizedWorker(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Fetch due email jobs with related data. Note: templates hang off
  // campaign_steps, and the provider integration hangs off sender_accounts,
  // so those are the only valid embed paths.
  const { data: jobs, error } = await supabase
    .from("email_jobs")
    .select(
      `*,
      leads(email, person_name),
      campaigns(user_id, name),
      campaign_steps(template_id, templates(subject, body_html, body_text)),
      sender_accounts(from_name, from_email, reply_to, signature, integration_id)`
    )
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString())
    .limit(MAX_BATCH)
    .order("scheduled_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Unable to load due jobs", details: error.message },
      { status: 500 }
    );
  }

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ processed: 0, message: "No due jobs" });
  }

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const job of jobs) {
    processed++;

    const lead = (job as any).leads as any;
    const campaign = (job as any).campaigns as any;
    const sender = (job as any).sender_accounts as any;
    const step = (job as any).campaign_steps as any;
    const template = Array.isArray(step?.templates)
      ? step.templates[0]
      : step?.templates;
    const userId = campaign?.user_id;

    if (!userId || !sender || !template || !lead?.email) {
      await supabase
        .from("email_jobs")
        .update({
          status: "failed",
          error: "Missing sender/campaign/template/lead email",
        })
        .eq("id", job.id);
      failed++;
      continue;
    }

    // Check suppression list
    const { data: suppressed } = await supabase
      .from("suppression_list")
      .select("id")
      .eq("user_id", userId)
      .eq("email", lead.email)
      .maybeSingle();

    if (suppressed) {
      await supabase
        .from("email_jobs")
        .update({ status: "failed", error: "Suppressed" })
        .eq("id", job.id);
      failed++;
      continue;
    }

    let integration: any = null;
    if (sender.integration_id) {
      const { data } = await supabase
        .from("integrations")
        .select("provider, encrypted_secret, iv, enabled")
        .eq("id", sender.integration_id)
        .maybeSingle();
      integration = data;
    }

    if (!integration || integration.enabled === false) {
      await supabase
        .from("email_jobs")
        .update({ status: "failed", error: "No enabled sender integration" })
        .eq("id", job.id);
      failed++;
      continue;
    }

    let secret: string;
    try {
      secret = decryptSecret({
        ciphertext: integration.encrypted_secret,
        iv: integration.iv,
      });
    } catch {
      await supabase
        .from("email_jobs")
        .update({ status: "failed", error: "Could not decrypt integration" })
        .eq("id", job.id);
      failed++;
      continue;
    }

    const appUrl = process.env.APP_URL || new URL(request.url).origin;
    const unsubToken = signUnsubscribeToken(lead.email, job.id);

    const input = {
      to: lead.email,
      toName: lead.person_name,
      from: sender.from_email,
      fromName: sender.from_name,
      replyTo: sender.reply_to,
      subject: template.subject || "Hello",
      html: injectTracking(template.body_html || "", job.id, appUrl),
      text: template.body_text || "",
      messageId: job.message_id,
      headers: {
        "List-Unsubscribe": `<${appUrl}/api/unsubscribe?email=${encodeURIComponent(
          lead.email
        )}&jobId=${job.id}&token=${unsubToken}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    };

    const result = await dispatchEmail(
      integration.provider as any,
      secret,
      input
    );

    if (result.success) {
      await supabase
        .from("email_jobs")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          attempts: (job.attempts || 0) + 1,
          error: null,
        })
        .eq("id", job.id);

      await supabase.from("email_events").insert({
        email_job_id: job.id,
        type: "sent",
        meta: { providerMessageId: result.providerMessageId },
      });

      await createAuditLog(userId, "email_sent", {
        jobId: job.id,
        leadId: job.lead_id,
        provider: integration.provider,
      });
      succeeded++;
    } else {
      const attempts = (job.attempts || 0) + 1;
      if (attempts < 3 && result.error) {
        const delayMs = Math.pow(2, attempts) * 60000;
        const nextAttempt = new Date(Date.now() + delayMs).toISOString();
        await supabase
          .from("email_jobs")
          .update({
            status: "scheduled",
            scheduled_at: nextAttempt,
            attempts,
            error: result.error,
          })
          .eq("id", job.id);
      } else {
        await supabase
          .from("email_jobs")
          .update({
            status: "failed",
            attempts,
            error: result.error,
          })
          .eq("id", job.id);
      }
      failed++;
    }
  }

  return NextResponse.json({
    processed,
    succeeded,
    failed,
    message: `Processed ${processed} jobs (${succeeded} sent, ${failed} failed/retried)`,
  });
}
