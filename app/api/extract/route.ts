import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import {
  getApifyKey,
  validateExtractionUrls,
  buildApifyInput,
  startApifyActor,
  getApifyActorId,
  syncExtractionJob,
} from "@/lib/apify";

const schema = z.object({
  sourceType: z.enum(["google-maps", "website-list", "directory", "linkedin"]),
  niche: z.string().trim().min(1, "Niche / keyword is required"),
  country: z.string().trim().min(1, "Country is required"),
  city: z.string().optional(),
  targetDesignations: z.array(z.string()).optional(),
  companySize: z.string().optional(),
  urls: z.string().optional(),
  maxLeads: z.number().min(1).max(1000),
  requireEmail: z.boolean().optional(),
  saveList: z.string().trim().min(1),
});

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues[0]?.message || "Invalid extraction request" },
      { status: 400 }
    );
  }

  const { saveList, ...params } = result.data;

  // SSRF validation on user-supplied URLs
  const suppliedUrls = (params.urls ?? "")
    .split(/\r?\n/)
    .map((url) => url.trim())
    .filter(Boolean);
  const urlCheck = validateExtractionUrls(suppliedUrls);
  if (!urlCheck.ok) {
    return NextResponse.json({ error: urlCheck.error }, { status: 400 });
  }

  // Create or reuse lead list
  let listId: string | null = null;
  const { data: list } = await supabase
    .from("lead_lists")
    .select("id")
    .eq("user_id", user.id)
    .eq("name", saveList)
    .maybeSingle();

  if (list) {
    listId = list.id;
  } else {
    const { data: newList, error: listError } = await supabase
      .from("lead_lists")
      .insert({ user_id: user.id, name: saveList })
      .select("id")
      .single();
    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 400 });
    }
    listId = newList.id;
  }

  // Get Apify key
  const apifyKey = await getApifyKey(user.id);
  if (!apifyKey) {
    return NextResponse.json(
      {
        error:
          "Apify API key not configured. Add it in Settings → Integrations.",
      },
      { status: 400 }
    );
  }

  const actorId = getApifyActorId(params.sourceType);

  // Create extraction job
  const { data: job, error } = await supabase
    .from("extraction_jobs")
    .insert({
      user_id: user.id,
      list_id: listId,
      params: { ...params, __actorId: actorId },
      actor: actorId,
      status: "queued",
      progress: 0,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Start the Apify run and return immediately. The extract page polls this
  // endpoint, which picks up finished runs and stores the leads. This avoids
  // serverless function timeouts on long scraper runs.
  try {
    const { runId, datasetId } = await startApifyActor(
      apifyKey,
      actorId,
      buildApifyInput(params)
    );

    await supabase
      .from("extraction_jobs")
      .update({
        status: "running",
        params: { ...params, __actorId: actorId, __runId: runId, __datasetId: datasetId },
      })
      .eq("id", job.id);

    await createAuditLog(user.id, "extraction_started", {
      jobId: job.id,
      actorId,
      runId,
    });

    return NextResponse.json({ jobId: job.id, status: "running", runId });
  } catch (err: any) {
    const message = err?.message || "Could not start Apify extraction";
    await supabase
      .from("extraction_jobs")
      .update({
        status: "failed",
        error: message,
        finished_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    await createAuditLog(user.id, "extraction_failed", {
      jobId: job.id,
      error: message,
    });

    return NextResponse.json({ error: message, jobId: job.id }, { status: 502 });
  }
}

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: jobs, error } = await supabase
    .from("extraction_jobs")
    .select("*, lead_lists(name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Pick up any runs that finished since the last poll.
  const running = (jobs || []).filter(
    (job) => job.status === "running" && job.params?.__runId
  );

  if (running.length > 0) {
    const apifyKey = await getApifyKey(user.id);
    if (apifyKey) {
      let changed = false;
      for (const job of running.slice(0, 10)) {
        try {
          const { completed } = await syncExtractionJob({
            supabase,
            apifyToken: apifyKey,
            job,
          });
          if (completed) changed = true;
        } catch {
          // Leave the job running; the next poll will retry.
        }
      }

      if (changed) {
        const { data: refreshed } = await supabase
          .from("extraction_jobs")
          .select("*, lead_lists(name)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        return NextResponse.json(refreshed || []);
      }
    }
  }

  return NextResponse.json(jobs || []);
}
