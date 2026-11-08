import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createAuditLog } from "@/lib/audit";
import {
  getApifyDatasetItems,
  getApifyKey,
  normalizeApifyOutput,
  saveLeadsForJob,
} from "@/lib/apify";

/**
 * Apify run webhook. Configure it on the actor with header
 * `x-apify-webhook-secret: <APIFY_WEBHOOK_SECRET>` (or `?secret=`).
 *
 * Accepts either MailFlow's simple payload
 *   { jobId, status, data? }
 * or Apify's native webhook payload
 *   { eventType, resource: { id, status, defaultDatasetId } }.
 */
export async function POST(request: Request) {
  const secret = process.env.APIFY_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "APIFY_WEBHOOK_SECRET is not configured" },
      { status: 503 }
    );
  }

  const url = new URL(request.url);
  const supplied =
    request.headers.get("x-apify-webhook-secret") ||
    url.searchParams.get("secret") ||
    "";

  if (supplied !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const resource = body?.resource || {};
  const jobId: string | undefined = body?.jobId || resource?.metadata?.jobId;
  const status: string = body?.status || resource?.status || "";
  const datasetId: string | undefined =
    resource?.defaultDatasetId || body?.datasetId;

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: job } = await supabase
    .from("extraction_jobs")
    .select("id, user_id, list_id, status, params")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // Idempotent: already finished jobs are acknowledged without changes.
  if (job.status === "completed" || job.status === "failed") {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  if (status && status !== "SUCCEEDED") {
    const failed =
      status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT";
    if (failed) {
      await supabase
        .from("extraction_jobs")
        .update({
          status: "failed",
          error: `Apify run ${status.toLowerCase()}`,
          finished_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    }
    return NextResponse.json({ ok: true });
  }

  let raw: any[] = Array.isArray(body?.data) ? body.data : [];
  if (raw.length === 0) {
    const apifyKey = await getApifyKey(job.user_id);
    if (!apifyKey) {
      return NextResponse.json(
        { error: "Apify key not configured for this user" },
        { status: 400 }
      );
    }
    const dsId = datasetId || job?.params?.__datasetId;
    if (!dsId) {
      return NextResponse.json({ error: "Missing dataset id" }, { status: 400 });
    }
    raw = await getApifyDatasetItems(apifyKey, dsId);
  }

  const source = job?.params?.sourceType || "google-maps";
  const normalized = normalizeApifyOutput(raw, source);

  const { inserted } = await saveLeadsForJob({
    supabase,
    userId: job.user_id,
    jobId: job.id,
    listId: job.list_id ?? null,
    leads: normalized,
    source,
  });

  await supabase
    .from("extraction_jobs")
    .update({
      status: "completed",
      progress: 100,
      result_count: inserted,
      finished_at: new Date().toISOString(),
      error: null,
    })
    .eq("id", job.id);

  await createAuditLog(job.user_id, "extraction_completed", {
    jobId: job.id,
    inserted,
    source,
  });

  return NextResponse.json({ ok: true, inserted });
}
