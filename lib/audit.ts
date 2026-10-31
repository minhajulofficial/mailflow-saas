import { createClient } from "@supabase/supabase-js";

export async function createAuditLog(userId: string | null, action: string, meta?: Record<string, any>) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await supabase.from("audit_logs").insert({
      user_id: userId,
      action,
      ip: meta?.ip,
      user_agent: meta?.user_agent,
      meta: meta || {},
    });
  } catch {
    // Audit logging should never break the main flow
  }
}
