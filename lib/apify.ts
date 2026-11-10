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
 *
 * Field names below match the actors' published input schemas:
 *  - compass/crawler-google-places: searchStringsArray, locationQuery,
 *    maxCrawledPlacesPerSearch, scrapeContacts, skipClosedPlaces
 *  - apify/website-content-crawler: startUrls, maxCrawlDepth, maxCrawlPages
 * Unknown fields are silently ignored by Apify, so using the wrong name makes
 * a run start and then fail with "INVALID INPUT" instead of erroring early.
 */
export function buildApifyInput(params: any): any {
  const { sourceType, niche, country, city, urls, maxLeads, requireEmail } = params;
  const limit = Math.min(Math.max(Number(maxLeads) || 50, 1), 1000);

  switch (sourceType) {
    case "google-maps": {
      // Keep the search term clean and pass the area via locationQuery:
      // embedding the location in the search string caps results at 120.
      const location = [city, country].filter(Boolean).join(", ");
      const input: any = {
        searchStringsArray: [niche].filter(Boolean),
        maxCrawledPlacesPerSearch: limit,
        language: "en",
        skipClosedPlaces: true,
        // Pull business emails/socials from each place's website — this is
        // what makes the extracted leads usable for cold email.
        scrapeContacts: true,
      };
      if (location) input.locationQuery = location;
      return input;
    }
    case "website-list":
    case "directory": {
      const startUrls = (urls || "")
        .split(/\r?\n/)
        .map((u: string) => u.trim())
        .filter(Boolean)
        .map((url: string) => ({ url }));
      return {
        startUrls,
        // Listings need one extra hop to reach detail pages.
        maxCrawlDepth: sourceType === "directory" ? 2 : 1,
        maxCrawlPages: limit,
        crawlerType: "playwright:adaptive",
      };
    }
    case "linkedin":
      // The LinkedIn option is disabled in the UI; keep a valid payload in
      // case the API is called directly.
      return {
        searchStringsArray: [`${niche} ${country}`].filter(Boolean),
        maxCrawledPlacesPerSearch: limit,
        language: "en",
      };
    default:
      return {};
  }
}

/**
 * Normalize Apify actor output into MailFlow lead format.
 *
 * Handles two shapes:
 *  - compass/crawler-google-places items (business-centric: title, website,
 *    phone, address, categoryName, countryCode) plus their optional
 *    `leadsEnrichment` / `impressum` person records.
 *  - apify/website-content-crawler items (page-centric: url, metadata.title).
 */
export function normalizeApifyOutput(rawOutput: any[], source: string): any[] {
  const seen = new Set<string>();
  const leads: any[] = [];

  const add = (lead: any) => {
    const email = String(lead.email || "").toLowerCase().trim() || null;
    const site = String(lead.website || lead.url || "").toLowerCase().trim();
    const name = String(lead.person_name || "").toLowerCase().trim();
    // Matching rules:
    //  - same email        -> same lead
    //  - same site, no person name -> same business
    //  - same site WITH person names -> different people at one company (keep both)
    const keys: string[] = [];
    if (email) keys.push(email);
    if (site) keys.push(name ? `${site}|${name}` : site);
    else if (name) keys.push(`name:${name}`);
    if (!keys.length) return;
    if (keys.some((k) => seen.has(k))) return;
    for (const k of keys) seen.add(k);
    leads.push({ ...lead, email });
  };

  for (const item of rawOutput || []) {
    const company =
      item.company || item.businessName || item.title || item.metadata?.title || null;
    const website = item.website || item.homepage || item.url || null;

    // Person records from the "business leads" add-on (paid) — one row each.
    const enrichment: any[] = Array.isArray(item.leadsEnrichment)
      ? item.leadsEnrichment
      : [];

    // Impressum (DE/AT/CH legal notice) contacts.
    const impressum: any = item.impressum || null;
    const impressumEmails: string[] = Array.isArray(impressum?.emails)
      ? impressum.emails.map((e: any) => e?.value).filter(Boolean)
      : [];
    const impressumPeople: any[] = Array.isArray(impressum?.people)
      ? impressum.people
      : [];

    const base = {
      company,
      website,
      phone: item.phone || item.phoneUnformatted || null,
      country: item.country || item.countryCode || null,
      state: item.state || item.region || null,
      city: item.city || null,
      address: item.address || item.fullAddress || null,
      niche: item.niche || item.category || item.categoryName || null,
      facebook: item.socialProfiles?.facebook || item.facebook || item.facebooks?.[0] || null,
      instagram: item.socialProfiles?.instagram || item.instagram || item.instagrams?.[0] || null,
      linkedin: item.socialProfiles?.linkedin || item.linkedin || item.linkedIns?.[0] || null,
      youtube: item.socialProfiles?.youtube || item.youtube || item.youtubes?.[0] || null,
      x_url: item.socialProfiles?.x || item.twitter || item.x_url || item.twitters?.[0] || null,
      tiktok: item.socialProfiles?.tiktok || item.tiktok || item.tiktoks?.[0] || null,
      source,
      tags: item.tags || [],
      status: "new",
    };

    const rating = item.totalScore ?? null;
    const reviews = item.reviewsCount ?? null;
    const tags = [
      ...(base.tags || []),
      ...(rating != null ? [`rating:${rating}`] : []),
      ...(reviews != null ? [`reviews:${reviews}`] : []),
    ];

    if (enrichment.length) {
      // Each enriched person becomes their own lead (they carry the emails).
      for (const person of enrichment) {
        add({
          ...base,
          tags,
          person_name: person.fullName ||
            [person.firstName, person.lastName].filter(Boolean).join(" ") ||
            null,
          designation: person.jobTitle || person.headline || null,
          company: person.companyName || company,
          website: person.companyWebsite
            ? `https://${String(person.companyWebsite).replace(/^https?:\/\//, "")}`
            : website,
          email: person.email || null,
          phone: person.mobileNumber || base.phone,
          linkedin: person.linkedinProfile || base.linkedin,
          country: person.country || base.country,
          city: person.city || base.city,
          state: person.state || base.state,
          email_status: person.email ? "unverified" : "invalid",
        });
      }
      continue;
    }

    if (impressumPeople.length) {
      for (const person of impressumPeople) {
        add({
          ...base,
          tags,
          person_name: person.name || null,
          designation: person.role || null,
          email: impressumEmails[0] || null,
          email_status: impressumEmails[0] ? "unverified" : "invalid",
        });
      }
      continue;
    }

    // Plain place/page record.
    const email =
      item.email || item.contactEmail || impressumEmails[0] ||
      (Array.isArray(item.emails) ? item.emails[0] : null) || null;

    add({
      ...base,
      tags,
      person_name: item.person_name || item.contactName || null,
      designation: item.designation || item.role || null,
      email,
      email_status: email ? "unverified" : "invalid",
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
