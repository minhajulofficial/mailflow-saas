import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import { isAuthorizedWorker } from "@/lib/worker-auth";
import { sendEmail } from "@/lib/email-provider";
import { decryptSecret } from "@/lib/encryption";
import { createAuditLog } from "@/lib/audit";

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

  // Fetch due email jobs with related data
  const { data: jobs, error } = await supabase
    .from("email_jobs")
    .select(`
      *,
      leads(email, person_name),
      campaigns(user_id, name),
      campaign_steps(template_id),
      templates(subject, body_html, body_text),
      sender_accounts(from_name, from_email, reply_to, signature, integration_id),
      integrations!inner(provider, encrypted_secret, iv)
    `)
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString())
    .limit(MAX_BATCH)
    .order("scheduled_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Unable to load due jobs" }, { status: 500 });
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
    const template = (job as any).templates as any;
    const userId = campaign?.user_id;

    if (!userId || !sender || !template) {
      await supabase
        .from("email_jobs")
        .update({ status: "failed", error: "Missing sender/campaign/template" })
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
      await supabase.from("email_jobs").update({ status: "failed", error: "Suppressed" }).eq("id", job.id);
      failed++;
      continue;
    }

    const integration = (job as any).integrations;
    if (!integration) {
      await supabase
        .from("email_jobs")
        .update({ status: "failed", error: "No sender integration" })
        .eq("id", job.id);
      failed++;
      continue;
    }

    const secret = decryptSecret({
      ciphertext: integration.encrypted_secret,
      iv: integration.iv,
    });

    const input = {
      to: lead.email,
      toName: lead.person_name,
      from: sender.from_email,
      fromName: sender.from_name,
      replyTo: sender.reply_to,
      subject: template.subject || "Hello",
      html: template.body_html || "",
      text: template.body_text || "",
      messageId: job.message_id,
      headers: {
        "List-Unsubscribe": `<${process.env.APP_URL}/api/unsubscribe?email=${encodeURIComponent(lead.email)}&token=${job.message_id}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    };

    const result = await sendEmail(
      userId,
      integration.provider as any,
      input,
      undefined
    );

    if (result.success) {
      await supabase.from("email_jobs").update({
        status: "sent",
        sent_at: new Date().toISOString(),
        attempts: (job.attempts || 0) + 1,
      }).eq("id", job.id);

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
      if (attempts < 3 && result.error && !result.error.includes("Suppressed")) {
        const delayMs = Math.pow(2, attempts) * 60000;
        const nextAttempt = new Date(Date.now() + delayMs).toISOString();
        await supabase.from("email_jobs").update({
          status: "scheduled",
          scheduled_at: nextAttempt,
          attempts,
          error: result.error,
        }).eq("id", job.id);
      } else {
        await supabase.from("email_jobs").update({
          status: "failed",
          attempts,
          error: result.error,
        }).eq("id", job.id);
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
