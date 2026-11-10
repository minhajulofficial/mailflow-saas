import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  currentPassword: z.string().min(1, "Enter your current password").max(200),
});

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid password" },
      { status: 400 }
    );
  }

  const { password, currentPassword } = parsed.data;

  // Prove the person behind the session knows the current password before
  // letting them rotate it (guards unattended sessions).
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: currentPassword,
  });
  if (verifyError) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    const message =
      error.message?.toLowerCase().includes("same")
        ? "Choose a password different from your current one"
        : error.message || "Could not update password";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
