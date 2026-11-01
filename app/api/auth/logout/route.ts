import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createAuditLog } from "@/lib/audit";

export async function POST() {
  const supabase = await createServerClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
