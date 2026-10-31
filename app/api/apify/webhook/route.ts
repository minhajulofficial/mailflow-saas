import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

const apifyAdapterRegistry: Record<string, (raw: any) => any[]> = {
  "apify/google-maps-scraper": normalizeGoogleMaps,
};

function normalizeGoogleMaps(raw: any): any[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => ({
    person_name: item.contactPerson || null,
    designation: item.designation || null,
    company: item.name || null,
    website: item.website || null,
    email: item.email || null,
    email_status: "unverified",
    phone: item.phone || null,
    facebook: item.facebook || null,
    instagram: item.instagram || null,
    linkedin: item.linkedin || null,
    youtube: item.youtube || null,
    x_url: item.twitter || null,
    tiktok: item.tiktok || null,
    country: item.country || null,
    state: item.state || null,
    city: item.city || null,
    address: item.address || null,
    niche: item.category || null,
    source: "google-maps",
    tags: item.tags || [],
    status: "new",
  }));
}

export async function POST(request: Request) {
  const supabase = createServiceClient();
  const { runId, status, data, jobId } = await request.json();

  if (!runId || !jobId) {
    return NextResponse.json({ error: "Missing runId or jobId" }, { status: 400 });
  }

  // Update job status
  await supabase
    .from("extraction_jobs")
    .update({ status: status === "SUCCEEDED" ? "completed" : "failed", finished_at: new Date().toISOString() })
    .eq("id", jobId);

  if (status === "SUCCEEDED" && data) {
    const actor = "apify/google-maps-scraper"; // In production, look up from job
    const normalize = apifyAdapterRegistry[actor];
    const normalized = normalize ? normalize(data) : data;

    // Get job to find user_id and list_id
    const { data: job } = await supabase
      .from("extraction_jobs")
      .select("user_id, list_id")
      .eq("id", jobId)
      .single();

    if (job) {
      const leads = normalized.map((lead: any) => ({
        ...lead,
        user_id: job.user_id,
        list_id: job.list_id,
        job_id: jobId,
        collected_at: new Date().toISOString(),
      }));

      // Insert with upsert to handle duplicates (user_id, lower(email))
      const { error } = await supabase.from("leads").upsert(leads, {
        onConflict: "user_id, email_lower", // requires functional unique index; fallback handled below
      });

      if (error) {
        // Fallback: insert individually, skip duplicates
        for (const lead of leads) {
          await supabase.from("leads").insert(lead).select("id");
        }
      }

      await supabase
        .from("extraction_jobs")
        .update({ result_count: leads.length, progress: 100 })
        .eq("id", jobId);
    }
  }

  return NextResponse.json({ ok: true });
}
