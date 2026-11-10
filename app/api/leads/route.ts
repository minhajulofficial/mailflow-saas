import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const querySchema = z.object({
  search: z.string().optional(),
  country: z.string().optional(),
  niche: z.string().optional(),
  status: z.string().optional(),
  listId: z.string().optional(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

const createSchema = z.object({
  person_name: z.string().trim().max(200).optional(),
  designation: z.string().trim().max(200).optional(),
  company: z.string().trim().max(200).optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().max(60).optional(),
  website: z.string().trim().max(300).optional(),
  country: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  address: z.string().trim().max(400).optional(),
  niche: z.string().trim().max(120).optional(),
  facebook: z.string().trim().max(300).optional(),
  instagram: z.string().trim().max(300).optional(),
  linkedin: z.string().trim().max(300).optional(),
  youtube: z.string().trim().max(300).optional(),
  x_url: z.string().trim().max(300).optional(),
  tiktok: z.string().trim().max(300).optional(),
  tags: z.array(z.string().max(60)).max(20).optional(),
  list_id: z.string().uuid().nullable().optional(),
});

/** Strip PostgREST `or` operators so a search string cannot alter the filter. */
function sanitizeSearch(value: string) {
  return value.replace(/[,()%*]/g, " ").trim();
}

export async function GET(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = querySchema.parse(Object.fromEntries(searchParams));

  let q = supabase
    .from("leads")
    .select("*, lead_lists(name)", { count: "exact" })
    .eq("user_id", user.id);

  const search = query.search ? sanitizeSearch(query.search) : "";
  if (search) {
    q = q.or(
      `person_name.ilike.%${search}%,company.ilike.%${search}%,email.ilike.%${search}%`
    );
  }
  if (query.country) q = q.eq("country", query.country);
  if (query.niche) q = q.eq("niche", query.niche);
  if (query.status) q = q.eq("status", query.status);
  if (query.listId) q = q.eq("list_id", query.listId);

  const page = Math.max(1, parseInt(query.page || "1", 10) || 1);
  const pageSize = Math.min(500, Math.max(1, parseInt(query.pageSize || "20", 10) || 20));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  q = q.order("collected_at", { ascending: false }).range(from, to);

  const { data, error, count } = await q;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ leads: data || [], total: count || 0, page, pageSize });
}

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid lead" },
      { status: 400 }
    );
  }

  const data = parsed.data;

  if (data.list_id) {
    const { data: list } = await supabase
      .from("lead_lists")
      .select("id")
      .eq("id", data.list_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!list) {
      return NextResponse.json({ error: "That list does not belong to you" }, { status: 400 });
    }
  }

  const { data: existing } = await supabase
    .from("leads")
    .select("id")
    .eq("user_id", user.id)
    .eq("email", data.email)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "A lead with that email already exists" }, { status: 409 });
  }

  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
      ...data,
      user_id: user.id,
      list_id: data.list_id ?? null,
      source: "manual",
      status: "new",
      email_status: "unverified",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(lead, { status: 201 });
}
