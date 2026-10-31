export const dynamic = "force-dynamic";

import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("replies")
    .select("*, leads(person_name, company, email)")
    .eq("leads.user_id", user.id)
    .order("received_at", { ascending: false });

  return NextResponse.json(data || []);
}
