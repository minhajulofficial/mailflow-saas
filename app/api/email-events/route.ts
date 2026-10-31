import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const body = await request.json();
  const { emailJobId, type, meta } = body;

  const { data, error } = await supabase
    .from("email_events")
    .insert({ email_job_id: emailJobId, type, meta })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Update job status based on event type
  if (type === "sent") {
    await supabase
      .from("email_jobs")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", emailJobId);
  }

  return NextResponse.json(data);
}
