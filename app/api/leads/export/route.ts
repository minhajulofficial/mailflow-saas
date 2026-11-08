import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const listId = searchParams.get("listId");
  const search = searchParams.get("search");
  const status = searchParams.get("status");

  let q = supabase
    .from("leads")
    .select("*")
    .eq("user_id", user.id);

  if (listId) q = q.eq("list_id", listId);
  if (status) q = q.eq("status", status);
  if (search) {
    const term = search.replace(/[,()%*]/g, " ").trim();
    if (term) {
      q = q.or(
        `person_name.ilike.%${term}%,company.ilike.%${term}%,email.ilike.%${term}%`
      );
    }
  }

  const { data, error } = await q.order("collected_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Build CSV with UTF-8 BOM for Excel compatibility
  const headers = [
    "Person Name", "Designation", "Company", "Website", "Email", "Email Status",
    "Phone", "Facebook", "Instagram", "LinkedIn", "YouTube", "X", "TikTok",
    "Country", "State", "City", "Address", "Niche", "Source", "Tags", "Status", "Collected At",
  ];

  const rows = (data || []).map((lead) => [
    lead.person_name || "",
    lead.designation || "",
    lead.company || "",
    lead.website || "",
    lead.email || "",
    lead.email_status || "",
    lead.phone || "",
    lead.facebook || "",
    lead.instagram || "",
    lead.linkedin || "",
    lead.youtube || "",
    lead.x_url || "",
    lead.tiktok || "",
    lead.country || "",
    lead.state || "",
    lead.city || "",
    lead.address || "",
    lead.niche || "",
    lead.source || "",
    (lead.tags || []).join("; "),
    lead.status || "",
    lead.collected_at || "",
  ]);

  // CSV injection protection: prefix cells starting with =, +, -, @
  const sanitize = (cell: string) => {
    const str = String(cell);
    if (/^[=+\-@]/.test(str)) return `'${str}`;
    return str;
  };

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map(sanitize).join(",")),
  ].join("\r\n");

  const bom = "\uFEFF";
  const csvWithBom = bom + csvContent;

  return new Response(csvWithBom, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mailflow-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
