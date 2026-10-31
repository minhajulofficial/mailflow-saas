import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  search: z.string().optional(),
  country: z.string().optional(),
  niche: z.string().optional(),
  status: z.string().optional(),
  listId: z.string().optional(),
  page: z.string().optional(),
  pageSize: z.string().optional(),
});

export async function GET(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = schema.parse(Object.fromEntries(searchParams));

  let q = supabase.from("leads").select("*, lead_lists(name)").eq("user_id", user.id);

  if (query.search) {
    q = q.or(`person_name.ilike.%${query.search}%,company.ilike.%${query.search}%,email.ilike.%${query.search}%`);
  }
  if (query.country) q = q.eq("country", query.country);
  if (query.niche) q = q.eq("niche", query.niche);
  if (query.status) q = q.eq("status", query.status);
  if (query.listId) q = q.eq("list_id", query.listId);

  const page = parseInt(query.page || "1", 10);
  const pageSize = parseInt(query.pageSize || "20", 10);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  q = q.order("collected_at", { ascending: false }).range(from, to);

  const { data, error, count } = await q;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ leads: data || [], total: count || 0, page, pageSize });
}
