import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/encryption";

export async function GET(request: Request) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("integrations")
    .select("id, provider, label, enabled, status, encrypted_secret, iv")
    .eq("user_id", user.id)
    .eq("provider", "apify")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "No Apify integration found" }, { status: 404 });
  }

  // Decrypt server-side only, never return plaintext to client
  const secret = decryptSecret({ ciphertext: data.encrypted_secret, iv: data.iv });
  const masked = `apify_api_••••••${secret.slice(-4)}`;

  return NextResponse.json({ id: data.id, provider: data.provider, maskedSecret: masked, status: data.status });
}
