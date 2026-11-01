import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isSSRFUrl } from "@/lib/security";
import { z } from "zod";

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

  const suppliedUrls = (result.data.urls ?? "")
    .split(/\r?\n/)
    .map((url) => url.trim())
    .filter(Boolean);
  if (suppliedUrls.some(isSSRFUrl)) {
    return NextResponse.json(
      { error: "Only public HTTP or HTTPS URLs can be used for extraction" },
      { status: 400 }
    );
  }

  const { saveList, ...params } = result.data;

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
