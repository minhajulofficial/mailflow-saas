import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";
import {
  getApifyKey,
  validateExtractionUrls,
  buildApifyInput,
  normalizeApifyOutput,
  runApifyActor,
  saveLeadsForJob,
} from "@/lib/apify";

const schema = z.object({
  sourceType: z.enum(["google-maps", "website-list", "directory", "linkedin"]),
  niche: z.string().min(1),
  country: z.string().min(1),
  city: z.string().optional(),
  targetDesignations: z.array(z.string()).optional(),
  companySize: z.string().optional(),
  urls: z.string().optional(),
  maxLeads: z.number().min(1).max(1000),
  requireEmail: z.boolean().optional(),
  saveList: z.string().min(1),
});

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
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
    .single();

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
      { error: "Apify API key not configured. Add it in Settings → Integrations." },
      { status: 400 }
    );
  }

  // Create extraction job
  const { data: job, error } = await supabase
    .from("extraction_jobs")
    .insert({
      user_id: user.id,
      list_id: listId,
      params,
      actor: "apify/google-maps-scraper",
      status: "queued",
      progress: 0,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Run Apify actor asynchronously (fire and forget - job status updated by webhook/poll)
  // In production this would be a background job; here we trigger inline with a timeout.
  void (async () => {
    try {
      await supabase
        .from("extraction_jobs")
        .update({ status: "running" })
        .eq("id", job.id);

      const actorId = "apify/google-maps-scraper"; // config-driven; override via params if needed
      const input = buildApifyInput(params);

      const rawOutput = await runApifyActor(apifyKey, actorId, input);
      const normalized = normalizeApifyOutput(rawOutput, params.sourceType);

      const { inserted } = await saveLeadsForJob({
        supabase,
        userId: user.id,
        jobId: job.id,
        listId,
        leads: normalized,
        source: params.sourceType,
      });

      await supabase
        .from("extraction_jobs")
        .update({
          status: "completed",
          progress: 100,
          result_count: inserted,
          finished_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      await createAuditLog(user.id, "extraction_completed", {
        jobId: job.id,
        inserted,
        source: params.sourceType,
      });
    } catch (err: any) {
      await supabase
        .from("extraction_jobs")
        .update({
          status: "failed",
          error: err.message || "Extraction failed",
          finished_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      await createAuditLog(user.id, "extraction_failed", {
        jobId: job.id,
        error: err.message || "Extraction failed",
      });
    }
  })();

  return NextResponse.json({ jobId: job.id, status: job.status });
}

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("extraction_jobs")
    .select("*, lead_lists(name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data || []);
}
