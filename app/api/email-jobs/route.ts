import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import { isAuthorizedWorker } from "@/lib/worker-auth";
import { z } from "zod";

const jobUpdateSchema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(["sent", "failed"]),
  error: z.string().max(1000).optional(),
});

export async function GET(request: Request) {
  if (!isAuthorizedWorker(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("email_jobs")
    .select("*, leads(*), campaigns(name)")
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

  const parsed = jobUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("email_jobs")
    .update({
      status: parsed.data.status,
      error: parsed.data.error ?? null,
      attempts: 1,
    })
    .eq("id", parsed.data.jobId)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Unable to update email job" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Email job not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
