import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";
import { createAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";
import { z } from "zod";
import { encryptSecret, maskSecret } from "@/lib/encryption";
import { testProviderSecret } from "@/lib/email-provider";

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
  }

  const { provider, secret, label } = result.data;

  // Encrypt the secret server-side only. A missing/malformed master key must
  // surface as a clear JSON error instead of an empty 500 response.
  let encrypted: { ciphertext: string; iv: string };
  try {
    encrypted = encryptSecret(secret);
  } catch (err: any) {
    return NextResponse.json(
      {
        error:
          "Server encryption key is not configured. Set ENCRYPTION_MASTER_KEY (base64 32 bytes) in your deployment environment, then try again.",
        detail: err?.message,
      },
      { status: 500 }
    );
  }

  // Test connection with the key the user just typed (not the stored one).
  const testResult = await testProviderSecret(provider, secret);

  const supabaseAdmin = getSupabaseAdmin();

  // One integration per provider per user: update instead of duplicating.
  const { data: existing } = await supabaseAdmin
    .from("integrations")
    .select("id")
    .eq("user_id", user.id)
    .eq("provider", provider)
    .maybeSingle();

  const payload = {
    user_id: user.id,
    provider,
    encrypted_secret: encrypted.ciphertext,
    iv: encrypted.iv,
    label,
    status: testResult.ok ? "connected" : "error",
    last_tested_at: new Date().toISOString(),
  };

  const { data, error } = existing
    ? await supabaseAdmin
        .from("integrations")
        .update(payload)
        .eq("id", existing.id)
        .eq("user_id", user.id)
        .select()
        .single()
    : await supabaseAdmin
        .from("integrations")
        .insert(payload)
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { id, ...updates } = body as Record<string, unknown>;

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
    let encrypted: { ciphertext: string; iv: string };
    try {
      encrypted = encryptSecret(secret);
    } catch (err: any) {
      return NextResponse.json(
        {
          error:
            "Server encryption key is not configured. Set ENCRYPTION_MASTER_KEY (base64 32 bytes) in your deployment environment, then try again.",
          detail: err?.message,
        },
        { status: 500 }
      );
    }
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

    if (existing?.provider) {
      testResult = await testProviderSecret(existing.provider, secret);
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
