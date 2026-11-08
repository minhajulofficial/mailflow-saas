import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/encryption";
import { testProviderSecret } from "@/lib/email-provider";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { data: integration, error: fetchError } = await supabase
    .from("integrations")
    .select("id, provider, encrypted_secret, iv")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError || !integration) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  let result: { ok: boolean; error?: string };
  try {
    const secret = decryptSecret({
      ciphertext: integration.encrypted_secret,
      iv: integration.iv,
    });
    result = await testProviderSecret(integration.provider, secret);
  } catch (err: any) {
    result = { ok: false, error: err?.message || "Could not decrypt secret" };
  }

  const { error: updateError } = await supabase
    .from("integrations")
    .update({
      status: result.ok ? "connected" : "error",
      last_tested_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json(result);
}
