import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@/lib/supabase/server";
import { createAuditLog } from "@/lib/audit";
import { NextResponse } from "next/server";
import { z } from "zod";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const schema = z.object({
  provider: z.enum(["apify", "brevo", "mailjet", "gmail", "smtp"]),
  secret: z.string().min(1),
  label: z.string().optional(),
});

export async function POST(request: Request) {
  const supabase = createServerClient();
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
  const { encryptSecret } = await import("@/lib/encryption");
  const encrypted = encryptSecret(secret);

  const { data, error } = await supabaseAdmin
    .from("integrations")
    .insert({
      user_id: user.id,
      provider,
      encrypted_secret: encrypted.ciphertext,
      iv: encrypted.iv,
      label,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await createAuditLog(user.id, "integration_added", { provider, label });

  return NextResponse.json({
    id: data.id,
    provider,
    label,
    status: data.status,
    maskedSecret: maskSecret(secret),
  });
}

function maskSecret(s: string): string {
  if (!s || s.length < 8) return "••••••••";
  return `••••••${s.slice(-4)}`;
}

export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
