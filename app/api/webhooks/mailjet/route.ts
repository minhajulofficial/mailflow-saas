import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const secret = process.env.MAILJET_WEBHOOK_SECRET;
  const signature = request.headers.get("x-signature") || request.headers.get("signature");

  const body = await request.text();

  if (secret && signature) {
    const { createHmac, timingSafeEqual } = await import("node:crypto");
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
    const messageId = event.MessageID || event.message_id;
    const eventType = (event.Event || event.event || "").toLowerCase();

    if (!messageId || !eventType) continue;

    const { data: existing } = await supabase
      .from("email_events")
      .select("id")
      .eq("meta->>MessageID", messageId)
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
        .eq("id", job.lead_id)
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
