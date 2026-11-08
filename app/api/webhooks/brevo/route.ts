import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

export async function POST(request: NextRequest) {
  const secret = process.env.BREVO_WEBHOOK_SECRET;
  const signature = request.headers.get("x-signature") || request.headers.get("signature");

  const body = await request.text();

  // Signature verification (HMAC-SHA256). If no secret configured, still process in dev but log.
  if (secret && signature) {
    const expected = createHmac("sha256", secret).update(body).digest("base64");
    const supplied = Buffer.from(signature, "utf8");
    const expectedBuf = Buffer.from(expected, "utf8");
    if (supplied.length !== expectedBuf.length || !timingSafeEqual(supplied, expectedBuf)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const events = Array.isArray(payload) ? payload : [payload];

  for (const event of events) {
    const messageId = event.message_id || event.MessageID;
    const eventType = (event.event || event.Event || "").toLowerCase();

    if (!messageId || !eventType) continue;

    // Idempotency: skip already-processed event
    const { data: existing } = await supabase
      .from("email_events")
      .select("id")
      .eq("meta->>message_id", messageId)
      .eq("type", eventType)
      .maybeSingle();

    if (existing) continue;

    const { data: job } = await supabase
      .from("email_jobs")
      .select("id, lead_id")
      .eq("message_id", messageId)
      .maybeSingle();

    if (!job) continue;

    await supabase.from("email_events").insert({
      email_job_id: job.id,
      type: eventType,
      meta: event,
    });

    if (eventType === "sent" || eventType === "delivered") {
      await supabase
        .from("email_jobs")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", job.id);
    }

    if (eventType === "bounce" || eventType === "spam" || eventType === "unsub") {
      const { data: lead } = await supabase
        .from("leads")
        .select("email, user_id")
        .eq("id", (job as any).lead_id)
        .maybeSingle();

      if (lead?.email) {
        await supabase.from("suppression_list").insert({
          user_id: lead.user_id,
          email: lead.email,
          reason: eventType,
        });
      }
      await supabase.from("email_jobs").update({ status: "failed", error: eventType }).eq("id", job.id);
    }
  }

  return NextResponse.json({ ok: true });
}
