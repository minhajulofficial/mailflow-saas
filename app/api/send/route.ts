import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import { isAuthorizedWorker } from "@/lib/worker-auth";
import { z } from "zod";

const createJobSchema = z.object({
  leadId: z.string().uuid(),
  campaignId: z.string().uuid(),
  stepId: z.string().uuid().nullable().optional(),
  senderId: z.string().uuid(),
  messageId: z.string().min(1).max(255),
  scheduledAt: z.string().datetime(),
});

const sendJobSchema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(["sent", "failed"]),
  providerMessageId: z.string().optional(),
  error: z.string().max(1000).optional(),
});

export async function GET(request: Request) {
  if (!isAuthorizedWorker(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("email_jobs")
    .select(
      "*, leads(email, person_name, company), campaigns(name, user_id), sender_accounts(*)"
    )
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString())
    .limit(100)
    .order("scheduled_at", { ascending: true });

  if (error) return NextResponse.json({ error: "Unable to load due email jobs" }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  if (!isAuthorizedWorker(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const job = parsed.data;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("email_jobs")
    .insert({
      campaign_id: job.campaignId,
      step_id: job.stepId ?? null,
      lead_id: job.leadId,
      sender_id: job.senderId,
      message_id: job.messageId,
      status: "scheduled",
      scheduled_at: job.scheduledAt,
      idempotency_key: `${job.campaignId}-${job.leadId}-${job.stepId ?? "initial"}`,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Unable to enqueue email job" }, { status: 409 });
  return NextResponse.json(data, { status: 201 });
}
