import { createClient } from "@supabase/supabase-js";
import { decryptSecret } from "@/lib/encryption";
import { isSSRFUrl } from "@/lib/security";
import { createAuditLog } from "@/lib/audit";

export interface ApifyIntegration {
  id: string;
  encrypted_secret: string;
  iv: string;
}

/**
 * Get the decrypted Apify API key for a user. Server-side only.
 */
export async function getApifyKey(userId: string): Promise<string | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data } = await supabase
    .from("integrations")
    .select("encrypted_secret, iv")
    .eq("user_id", userId)
    .eq("provider", "apify")
    .eq("enabled", true)
    .maybeSingle();

  if (!data) return null;

  return decryptSecret({
    ciphertext: data.encrypted_secret,
    iv: data.iv,
  });
}

/**
 * Validate that user-supplied URLs are public HTTP/HTTPS (SSRF protection).
 */
export function validateExtractionUrls(urls: string[]): { ok: boolean; error?: string } {
  for (const url of urls) {
    if (isSSRFUrl(url)) {
      return { ok: false, error: `Unsafe URL blocked: ${url}` };
    }
  }
  return { ok: true };
}

/**
 * Build Apify actor input based on extraction params.
 */
export function buildApifyInput(params: any): any {
  const { sourceType, niche, country, city, urls, maxLeads, targetDesignations, requireEmail } = params;

  switch (sourceType) {
    case "google-maps":
      return {
        searchStrings: [`${niche} ${city ? city + ", " : ""}${country}`].filter(Boolean),
        maxLocations: Math.min(maxLeads || 50, 500),
        language: "en",
        includeWebResults: true,
      };
    case "website-list":
      return {
        startUrls: (urls || "").split("\n").map((u: string) => ({ url: u.trim() })).filter(Boolean),
        maxDepth: 1,
        maxPages: Math.min(maxLeads || 50, 500),
      };
    case "directory":
      return {
        startUrls: (urls || "").split("\n").map((u: string) => ({ url: u.trim() })).filter(Boolean),
        maxPages: Math.min(maxLeads || 50, 500),
      };
    case "linkedin":
      return {
        searchQueries: [`${niche} ${country} site:linkedin.com/in`],
        maxProfiles: Math.min(maxLeads || 50, 500),
      };
    default:
      return {};
  }
}

/**
 * Normalize Apify actor output into MailFlow lead format.
 */
export function normalizeApifyOutput(rawOutput: any[], source: string): any[] {
  const seen = new Set<string>();
  const leads: any[] = [];

  for (const item of rawOutput || []) {
    const email = (item.email || item.contactEmail || "").toLowerCase().trim();
    const dedupeKey = email || (item.website || item.url || "").toLowerCase();

    if (!dedupeKey || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    leads.push({
      person_name: item.person_name || item.name || item.contactName || null,
      designation: item.designation || item.title || item.role || null,
      company: item.company || item.businessName || item.title || null,
      website: item.website || item.homepage || item.url || null,
      email: email || null,
      phone: item.phone || item.contactPhone || null,
      facebook: item.socialProfiles?.facebook || item.facebook || null,
      instagram: item.socialProfiles?.instagram || item.instagram || null,
      linkedin: item.socialProfiles?.linkedin || item.linkedin || null,
      youtube: item.socialProfiles?.youtube || item.youtube || null,
      x_url: item.socialProfiles?.x || item.twitter || item.x_url || null,
      tiktok: item.socialProfiles?.tiktok || item.tiktok || null,
      country: item.country || null,
      state: item.state || item.region || null,
      city: item.city || null,
      address: item.address || item.fullAddress || null,
      niche: item.niche || item.category || null,
      source,
      tags: item.tags || [],
      email_status: email ? "unverified" : "invalid",
      status: "new",
    });
  }

  return leads;
}

/**
 * Call Apify actor and wait for run to finish (with timeout).
 * Returns normalized leads.
 */
export async function runApifyActor(
  apifyToken: string,
  actorId: string,
  input: any
): Promise<any[]> {
  const baseUrl = "https://api.apify.com";
  const runResponse = await fetch(
    `${baseUrl}/v2/acts/${encodeURIComponent(actorId)}/runs`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apifyToken}`,
      },
      body: JSON.stringify(input),
    }
  );

  if (!runResponse.ok) {
    const errorText = await runResponse.text();
    throw new Error(`Apify run failed: ${runResponse.status} ${errorText}`);
  }

  const runData = await runResponse.json();
  const runId = runData.data.id;

  // Poll for completion (max ~2 minutes for serverless)
  const maxWaitMs = 110 * 1000;
  const pollInterval = 3000;
  let waited = 0;

  while (waited < maxWaitMs) {
    await new Promise((r) => setTimeout(r, pollInterval));
    waited += pollInterval;

    const statusResponse = await fetch(
      `${baseUrl}/v2/actor-runs/${runId}`,
      {
        headers: { Authorization: `Bearer ${apifyToken}` },
      }
    );

    if (!statusResponse.ok) {
      throw new Error(`Failed to check Apify run status`);
    }

    const statusData = await statusResponse.json();
    const status = statusData.data.status;

    if (status === "SUCCEEDED") break;
    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      throw new Error(`Apify run ${status.toLowerCase()}`);
    }
  }

  if (waited >= maxWaitMs) {
    throw new Error("Apify run timed out");
  }

  // Fetch dataset items
  const datasetResponse = await fetch(
    `${baseUrl}/v2/actor-runs/${runId}/dataset/items`,
    {
      headers: { Authorization: `Bearer ${apifyToken}` },
    }
  );

  if (!datasetResponse.ok) {
    throw new Error("Failed to fetch Apify dataset");
  }

  return datasetResponse.json();
}

/**
 * Save extracted leads to the database for a user.
 */
export async function saveLeadsForJob({
  supabase,
  userId,
  jobId,
  listId,
  leads,
  source,
}: {
  supabase: any;
  userId: string;
  jobId: string;
  listId: string | null;
  leads: any[];
  source: string;
}) {
  if (!leads.length) return { inserted: 0 };

  // Check existing emails to avoid duplicates within this user
  const emails = leads.map((l) => l.email).filter(Boolean);
  let existingEmails: Set<string> = new Set();
  if (emails.length) {
    const { data: existing } = await supabase
      .from("leads")
      .select("email")
      .eq("user_id", userId)
      .in("email", emails);
    for (const e of (existing || []) as any[]) {
      if (e.email) existingEmails.add(e.email.toLowerCase());
    }
  }

  const newLeads = leads
    .filter((l) => !l.email || !existingEmails.has(String(l.email).toLowerCase()))
    .map((l) => ({
      user_id: userId,
      job_id: jobId,
      list_id: listId,
      person_name: l.person_name,
      designation: l.designation,
      company: l.company,
      website: l.website,
      email: l.email,
      phone: l.phone,
      facebook: l.facebook,
      instagram: l.instagram,
      linkedin: l.linkedin,
      youtube: l.youtube,
      x_url: l.x_url,
      tiktok: l.tiktok,
      country: l.country,
      state: l.state,
      city: l.city,
      address: l.address,
      niche: l.niche,
      source,
      tags: l.tags || [],
      status: "new",
      email_status: l.email_status || "unverified",
    }));

  if (!newLeads.length) return { inserted: 0 };

  const { error } = await supabase.from("leads").insert(newLeads as any[]);

  if (error) throw error;

  return { inserted: newLeads.length };
}

/**
 * Actor used for Google Maps extraction. Override with APIFY_ACTOR_ID.
 */
export function getApifyActorId(sourceType: string): string {
  if (process.env.APIFY_ACTOR_ID) return process.env.APIFY_ACTOR_ID;
  if (sourceType === "google-maps") return "compass~crawler-google-places";
  // Website/directory crawler
  return "apify~website-content-crawler";
}

/**
 * Start an Apify actor run without waiting for it to finish.
 * Returns enough information to poll it later from the UI.
 */
export async function startApifyActor(
  apifyToken: string,
  actorId: string,
  input: any
): Promise<{ runId: string; datasetId: string | null }> {
  const response = await fetch(
    `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apifyToken}`,
      },
      body: JSON.stringify(input),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Apify could not start the actor: ${response.status} ${errorText.slice(0, 300)}`
    );
  }

  const payload = await response.json();
  const run = payload?.data;
  if (!run?.id) throw new Error("Apify did not return a run id");

  return { runId: run.id, datasetId: run.defaultDatasetId ?? null };
}

export async function getApifyRun(
  apifyToken: string,
  runId: string
): Promise<{ status: string; datasetId: string | null }> {
  const response = await fetch(`https://api.apify.com/v2/actor-runs/${runId}`, {
    headers: { Authorization: `Bearer ${apifyToken}` },
  });
  if (!response.ok) {
    throw new Error(`Could not check Apify run (HTTP ${response.status})`);
  }
  const payload = await response.json();
  return {
    status: payload?.data?.status || "UNKNOWN",
    datasetId: payload?.data?.defaultDatasetId ?? null,
  };
}

export async function getApifyDatasetItems(
  apifyToken: string,
  datasetId: string
): Promise<any[]> {
  const response = await fetch(
    `https://api.apify.com/v2/datasets/${datasetId}/items?clean=true&format=json`,
    { headers: { Authorization: `Bearer ${apifyToken}` } }
  );
  if (!response.ok) {
    throw new Error(`Could not read Apify dataset (HTTP ${response.status})`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Check a running extraction job and finish it when Apify is done.
 */
export async function syncExtractionJob({
  supabase,
  apifyToken,
  job,
}: {
  supabase: any;
  apifyToken: string;
  job: any;
}): Promise<{ completed: boolean }> {
  const runId = job?.params?.__runId as string | undefined;
  if (!runId) return { completed: false };

  const run = await getApifyRun(apifyToken, runId);

  if (run.status === "SUCCEEDED") {
    const raw = run.datasetId
      ? await getApifyDatasetItems(apifyToken, run.datasetId)
      : [];
    const normalized = normalizeApifyOutput(
      raw,
      job?.params?.sourceType || "google-maps"
    );
    const { inserted } = await saveLeadsForJob({
      supabase,
      userId: job.user_id,
      jobId: job.id,
      listId: job.list_id ?? null,
      leads: normalized,
      source: job?.params?.sourceType || "google-maps",
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
      source: job?.params?.sourceType,
    });

    return { completed: true };
  }

  if (["FAILED", "ABORTED", "TIMED-OUT"].includes(run.status)) {
    await supabase
      .from("extraction_jobs")
      .update({
        status: "failed",
        error: `Apify run ${run.status.toLowerCase()}`,
        finished_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    return { completed: true };
  }

  return { completed: false };
}

/**
 * Test Apify connection by making a lightweight API call.
 */
export async function testApifyConnection(apifyToken: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch("https://api.apify.com/v2/users/me", {
      headers: { Authorization: `Bearer ${apifyToken}` },
    });
    if (!response.ok) {
      return { ok: false, error: `Apify auth failed: ${response.status}` };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "Apify connection test failed" };
  }
}
