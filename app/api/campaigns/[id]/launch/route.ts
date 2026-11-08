import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";

const launchSchema = z.object({
  templateId: z.string().uuid("Choose a template"),
  senderId: z.string().uuid("Choose a sender account"),
  listId: z.string().uuid().nullable().optional(),
  limit: z.number().int().min(1).max(5000).optional(),
});

/**
 * Queues the campaign: creates its first step (if needed) and one email job per
 * lead that has an email address and is not suppressed.
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
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = launchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid launch options" },
      { status: 400 }
    );
  }
  const { templateId, senderId, listId, limit } = parsed.data;

  const [{ data: template }, { data: sender }] = await Promise.all([
    supabase
      .from("templates")
      .select("id, name")
      .eq("id", templateId)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("sender_accounts")
      .select("*, integrations(id, provider, enabled, status)")
      .eq("id", senderId)
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!template) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }
  if (!sender) {
    return NextResponse.json({ error: "Sender account not found" }, { status: 404 });
  }
  if (sender.enabled === false) {
    return NextResponse.json({ error: "That sender account is disabled" }, { status: 400 });
  }
  const provider = (sender as any).integrations?.provider;
  if (!provider || !["brevo", "mailjet"].includes(provider)) {
    return NextResponse.json(
      {
        error:
          "This sender is not connected to a Brevo or Mailjet integration. Add a provider key in Settings → Integrations, then link it to the sender.",
      },
      { status: 400 }
    );
  }

  // Create the first step (or reuse it) and point it at the chosen template.
  const { data: existingStep } = await supabase
    .from("campaign_steps")
    .select("id")
    .eq("campaign_id", id)
    .eq("step_no", 1)
    .maybeSingle();

  const stepPayload = { campaign_id: id, step_no: 1, template_id: templateId };
  const { data: step, error: stepError } = existingStep
    ? await supabase
        .from("campaign_steps")
        .update({ template_id: templateId })
        .eq("id", existingStep.id)
        .select()
        .single()
    : await supabase.from("campaign_steps").insert(stepPayload).select().single();

  if (stepError) {
    return NextResponse.json({ error: stepError.message }, { status: 400 });
  }

  // Load candidate leads.
  let leadQuery = supabase
    .from("leads")
    .select("id, email")
    .eq("user_id", user.id)
    .not("email", "is", null);

  if (listId) leadQuery = leadQuery.eq("list_id", listId);

  const { data: leads, error: leadsError } = await leadQuery.limit(limit ?? 5000);

  if (leadsError) {
    return NextResponse.json({ error: leadsError.message }, { status: 400 });
  }

  const { data: suppressed } = await supabase
    .from("suppression_list")
    .select("email")
    .eq("user_id", user.id);

  const suppressedEmails = new Set(
    (suppressed || []).map((s) => String(s.email).toLowerCase())
  );

  const recipients = (leads || []).filter(
    (lead) => lead.email && !suppressedEmails.has(String(lead.email).toLowerCase())
  );

  if (recipients.length === 0) {
    return NextResponse.json(
      {
        error:
          "No recipients found. Extract leads with email addresses first (or pick a different list).",
      },
      { status: 400 }
    );
  }

  // Space sends out using the sender account's delay settings.
  const minDelay = sender.min_delay ?? 30;
  const maxDelay = sender.max_delay ?? 120;
  const avgDelay = Math.max(1, Math.round((minDelay + maxDelay) / 2));
  const start = Date.now() + 15_000;

  const rows = recipients.map((lead, index) => ({
    campaign_id: id,
    step_id: step.id,
    lead_id: lead.id,
    sender_id: senderId,
    message_id: `<${campaign.id}-${lead.id}-${step.id}@mailflow>`,
    status: "scheduled",
    scheduled_at: new Date(start + index * avgDelay * 1000).toISOString(),
    idempotency_key: `${campaign.id}-${lead.id}-${step.id}`,
  }));

  // Upsert so re-launching a campaign never double-sends.
  const { error: insertError } = await supabase
    .from("email_jobs")
    .upsert(rows, { onConflict: "idempotency_key", ignoreDuplicates: true });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  await supabase
    .from("campaigns")
    .update({
      status: "scheduled",
      sender_ids: [senderId],
      recipient_filter: { listId: listId ?? null },
    })
    .eq("id", id);

  await createAuditLog(user.id, "campaign_launched", {
    campaignId: id,
    templateId,
    senderId,
    listId: listId ?? null,
    recipients: rows.length,
  });

  return NextResponse.json({
    ok: true,
    queued: rows.length,
    firstSendAt: rows[0]?.scheduled_at,
    stepId: step.id,
  });
}
