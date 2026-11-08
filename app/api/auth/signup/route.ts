import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(1, "Name is required"),
});

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const body = await request.json();
  const result = signupSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
  }

  const { email, password, name } = result.data;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
      },
    },
  });

  if (error) {
    await createAuditLog(null, "signup_failed", { email, reason: error.message });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await createAuditLog(data.user?.id ?? null, "signup_success", { email });

  return NextResponse.json({
    user: data.user,
    session: data.session,
    message:
      "Account created. Please check your email to confirm your address.",
  });
}
