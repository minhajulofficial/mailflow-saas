import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";

const signupSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().trim().min(1, "Name is required"),
});

function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message || "Invalid input";
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = signupSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: firstIssue(result.error) },
      { status: 400 }
    );
  }

  const { email, password, name } = result.data;
  const origin = new URL(request.url).origin;
  const supabase = await createServerClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });

  if (error) {
    await createAuditLog(null, "signup_failed", { email, reason: error.message });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await createAuditLog(data.user?.id ?? null, "signup_success", { email });

  // When email confirmation is disabled Supabase returns a session and the
  // auth cookies are already set on this response. Tell the client to go
  // straight to the dashboard instead of asking the user to log in again.
  if (data.session) {
    return NextResponse.json({
      user: { id: data.user?.id, email: data.user?.email },
      signedIn: true,
      redirectTo: "/app",
      message: "Account created. You are now signed in.",
    });
  }

  return NextResponse.json({
    user: { id: data.user?.id, email: data.user?.email },
    signedIn: false,
    message:
      "Account created. Please check your email to confirm your address.",
  });
}
