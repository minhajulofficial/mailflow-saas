import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
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

  const result = loginSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: firstIssue(result.error) },
      { status: 400 }
    );
  }

  const { email, password } = result.data;
  const supabase = await createServerClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    await createAuditLog(null, "login_failed", {
      email,
      reason: error.message,
    });

    // Give the UI enough information to render a helpful next step.
    const unconfirmed =
      error.message.toLowerCase().includes("email not confirmed") ||
      error.code === "email_not_confirmed";

    return NextResponse.json(
      {
        error: unconfirmed
          ? "Your email is not confirmed yet. Check your inbox for the confirmation link."
          : error.message,
        code: unconfirmed ? "email_not_confirmed" : error.code || null,
      },
      { status: 401 }
    );
  }

  await createAuditLog(data.user?.id ?? null, "login_success", { email });

  return NextResponse.json({
    user: { id: data.user?.id, email: data.user?.email },
    redirectTo: "/app",
  });
}
