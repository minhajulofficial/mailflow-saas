import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

/**
 * Re-sends the signup confirmation email. Used by the login screen when
 * Supabase reports "Email not confirmed".
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Please enter a valid email address" },
      { status: 400 }
    );
  }

  const origin = new URL(request.url).origin;
  const supabase = await createServerClient();

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: result.data.email,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
