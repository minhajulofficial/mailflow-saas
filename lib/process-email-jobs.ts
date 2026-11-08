import { createServiceClient } from "@/lib/supabase/service";
import { dispatchEmail, type EmailProvider } from "@/lib/email-provider";
import { decryptSecret } from "@/lib/encryption";
import { createAuditLog } from "@/lib/audit";
import { signUnsubscribeToken } from "@/lib/unsubscribe-token";
import { injectTracking } from "@/lib/tracking";

const DEFAULT_BATCH = 50;

export interface ProcessResult {
  processed: number;
  succeeded: number;
  failed: number;
}

/**
 * Sends every due email job (status=scheduled, scheduled_at <= now).
 *
 * Shared by the cron/worker endpoint and by "Send now" in the campaign page so
 * both use exactly the same sending, tracking and retry logic.
 */
export async function processDueEmailJobs({
  limit = DEFAULT_BATCH,
  campaignId,
  appUrl,
}: {
  limit?: number;
  campaignId?: string;
  appUrl: string;
}): Promise<ProcessResult> {
  const supabase = createServiceClient();

  let query = supabase
    .from("email_jobs")
    .select(
      `*,
      leads(email, person_name),
      campaigns(user_id, name, status),
      campaign_steps(template_id, templates(subject, body_html, body_text)),
      sender_accounts(from_name, from_email, reply_to, signature, integration_id)`
    )
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 100));

  if (campaignId) query = query.eq("campaign_id", campaignId);

  const { data: jobs, error } = await query;

  if (error) {
    throw new Error(`Unable to load due jobs: ${error.message}`);
  }

  if (!jobs || jobs.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const job of jobs) {
    processed++;

    const lead = (job as any).leads;
    const campaign = (job as any).campaigns;
    const sender = (job as any).sender_accounts;
    const step = (job as any).campaign_steps;
    const template = Array.isArray(step?.templates)
      ? step.templates[0]
      : step?.templates;
    const userId = campaign?.user_id;

    if (campaign?.status === "paused") {
      // Leave the job scheduled; it will go out after the user resumes.
      continue;
    }

    if (campaign?.status === "cancelled") {
      await supabase
        .from("email_jobs")
        .update({ status: "failed", error: "Campaign cancelled" })
        .eq("id", job.id);
      failed++;
      continue;
    }

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
      integration.provider as EmailProvider,
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

  // Mark campaigns completed when nothing is left to send.
  const affectedCampaigns = new Set<string>(
    (jobs || [])
      .map((job: any) => job.campaign_id)
      .filter((value: any): value is string => Boolean(value))
  );
  if (campaignId) affectedCampaigns.add(campaignId);

  for (const affected of affectedCampaigns) {
    const { count } = await supabase
      .from("email_jobs")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", affected)
      .in("status", ["scheduled", "sending"]);

    if ((count || 0) === 0) {
      await supabase
        .from("campaigns")
        .update({ status: "completed" })
        .eq("id", affected)
        .in("status", ["scheduled", "sending"]);
    }
  }

  return { processed, succeeded, failed };
}
