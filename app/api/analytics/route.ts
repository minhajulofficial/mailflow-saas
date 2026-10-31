import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("email_events")
    .select("*, email_jobs(campaign_id, lead_id)")
    .order("occurred_at", { ascending: false })
    .limit(100);

  return NextResponse.json(data || []);
}
