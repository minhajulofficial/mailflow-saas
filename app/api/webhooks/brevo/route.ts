import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const body = await request.json();
  const { signature, timestamp, payload } = body;

  const { data, error } = await supabase
    .from("email_events")
    .insert({
      email_job_id: payload.message_id,
      type: payload.event,
      meta: payload,
    })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
