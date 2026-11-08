import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function POST(request: Request) {
  const supabase = await createServerClient();
  const body = await request.json();
  const result = loginSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
  }

  const { email, password } = result.data;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    await createAuditLog(null, "login_failed", { email, reason: error.message });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await createAuditLog(data.user?.id, "login_success", { email });

  return NextResponse.json({
    user: data.user,
    session: data.session,
  });
}
