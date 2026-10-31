import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import { decryptSecret } from "@/lib/encryption";

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const body = await request.json();
  const { leadId, campaignId, stepId, senderId, messageId, scheduledAt } = body;

  const { data, error } = await supabase
    .from("email_jobs")
    .insert({
      campaign_id: campaignId,
      step_id: stepId,
      lead_id: leadId,
      sender_id: senderId,
      message_id: messageId,
      status: "scheduled",
      scheduled_at: scheduledAt,
      idempotency_key: `${campaignId}-${leadId}-${stepId}`,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Trigger actual send via background worker (Inngest/Trigger.dev)
  // For MVP, this is enqueued; worker picks it up
  return NextResponse.json(data);
}

export async function GET() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("email_jobs")
    .select("*")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString())
    .order("scheduled_at", { ascending: true });

  return NextResponse.json(data || []);
}
