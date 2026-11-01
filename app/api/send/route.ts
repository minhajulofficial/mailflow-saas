import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("email_jobs")
    .select("*, leads(*), campaigns(name)")
    .eq("status", "scheduled")
    .lte("scheduled_at", new Date().toISOString())
    .limit(100)
    .order("scheduled_at", { ascending: true });

  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const body = await request.json();
  const { jobId, status, error: err } = body;

  await supabase
    .from("email_jobs")
    .update({ status, error: err, attempts: 1 })
    .eq("id", jobId);

  return NextResponse.json({ ok: true });
}
