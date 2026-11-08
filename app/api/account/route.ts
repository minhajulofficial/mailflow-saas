import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  confirm: z
    .string()
    .trim()
    .refine((value) => value === "DELETE", {
      message: "Type DELETE to confirm",
    }),
});

/**
 * Permanently deletes the signed-in account. Cascades to profiles, leads,
 * campaigns, templates, integrations and sender accounts via FK constraints.
 */
export async function DELETE(request: Request) {
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
      { error: parsed.error.issues[0]?.message || "Type DELETE to confirm" },
      { status: 400 }
    );
  }

  const admin = createServiceClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    return NextResponse.json(
      { error: error.message || "Could not delete account" },
      { status: 400 }
    );
  }

  await supabase.auth.signOut().catch(() => undefined);

  return NextResponse.json({ ok: true });
}
