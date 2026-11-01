import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { decryptSecret } from "@/lib/encryption";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { data: integration } = await supabase
    .from("integrations")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!integration) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  // Decrypt and test connection server-side only
  const { encrypted_secret, iv, provider } = integration;
  const secret = decryptSecret({ ciphertext: encrypted_secret, iv });

  let ok = false;
  let error = "";

  try {
    if (provider === "apify") {
      const res = await fetch("https://api.apify.com/v2/users/me", {
        headers: { Authorization: `Bearer ${secret}` },
      });
      ok = res.ok;
      if (!ok) error = `Apify API returned ${res.status}`;
    } else if (provider === "brevo") {
      const res = await fetch("https://api.brevo.com/v3/account", {
        headers: { "api-key": secret },
      });
      ok = res.ok;
      if (!ok) error = `Brevo API returned ${res.status}`;
    } else if (provider === "mailjet") {
      // Mailjet requires API key + secret; simplified check
      ok = secret.length > 0;
    } else {
      ok = true; // SMTP/Gmail tested at send time
    }
  } catch (e: any) {
    error = e.message;
  }

  const supabaseAdmin = createServiceClient();
  await supabaseAdmin
    .from("integrations")
    .update({ status: ok ? "connected" : "error", last_tested_at: new Date().toISOString() })
    .eq("id", id);

  return NextResponse.json({ ok, error });
}
