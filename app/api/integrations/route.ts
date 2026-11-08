import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";
import { createAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";
import { z } from "zod";
import { encryptSecret, maskSecret } from "@/lib/encryption";
import { testProviderConnection } from "@/lib/email-provider";
import { testApifyConnection } from "@/lib/apify";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const schema = z.object({
  provider: z.enum(["apify", "brevo", "mailjet", "gmail", "smtp"]),
  secret: z.string().min(1),
  label: z.string().optional(),
});

const updateSchema = z.object({
  secret: z.string().min(1).optional(),
  label: z.string().optional(),
  enabled: z.boolean().optional(),
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

  const { provider, secret, label } = result.data;

  // Encrypt the secret server-side only
  const encrypted = encryptSecret(secret);

  // Test connection before saving
  let testResult: { ok: boolean; error?: string } = { ok: false, error: "Unknown provider" };
  if (provider === "apify") {
    testResult = await testApifyConnection(secret);
  } else if (["brevo", "mailjet", "gmail", "smtp"].includes(provider)) {
    testResult = await testProviderConnection(user.id, provider as any);
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("integrations")
    .insert({
      user_id: user.id,
      provider,
      encrypted_secret: encrypted.ciphertext,
      iv: encrypted.iv,
      label,
      status: testResult.ok ? "connected" : "error",
      last_tested_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await createAuditLog(user.id, "integration_added", {
    provider,
    label,
    status: testResult.ok ? "connected" : "error",
    error: testResult.error,
  });

  return NextResponse.json({
    id: data.id,
    provider,
    label,
    status: data.status,
    maskedSecret: maskSecret(secret),
    testError: testResult.error,
  });
}

export async function GET() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("integrations")
    .select("id, provider, label, enabled, status, last_tested_at, created_at, updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data || []);
}

export async function PATCH(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Integration id is required" }, { status: 400 });
  }

  const result = updateSchema.safeParse(updates);
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
  }

  const { secret, label, enabled } = result.data;
  const updateData: any = {};
  if (label !== undefined) updateData.label = label;
  if (enabled !== undefined) updateData.enabled = enabled;

  if (secret) {
    const encrypted = encryptSecret(secret);
    updateData.encrypted_secret = encrypted.ciphertext;
    updateData.iv = encrypted.iv;
    updateData.last_tested_at = new Date().toISOString();

    let testResult: { ok: boolean; error?: string } = { ok: false, error: "Unknown provider" };
    const { data: existing } = await supabase
      .from("integrations")
      .select("provider")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing?.provider === "apify") {
      testResult = await testApifyConnection(secret);
    } else if (existing?.provider) {
      testResult = await testProviderConnection(user.id, existing.provider as any);
    }

    updateData.status = testResult.ok ? "connected" : "error";
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("integrations")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await createAuditLog(user.id, "integration_updated", { id, provider: data.provider, changes: updates });

  return NextResponse.json({
    id: data.id,
    provider: data.provider,
    status: data.status,
    label: data.label,
    enabled: data.enabled,
  });
}

export async function DELETE(request: Request) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Integration id is required" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: existing } = await supabaseAdmin
    .from("integrations")
    .select("provider")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Integration not found" }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from("integrations")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await createAuditLog(user.id, "integration_deleted", { id, provider: existing.provider });

  return NextResponse.json({ ok: true });
}
