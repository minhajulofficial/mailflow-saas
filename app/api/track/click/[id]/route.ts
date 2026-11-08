import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createAuditLog } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url");
  const trackingId = request.nextUrl.pathname.split("/").pop();
  if (!rawUrl) return new Response("Missing url", { status: 400 });
  if (!trackingId) return new Response("Missing tracking id", { status: 400 });

  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    return new Response("Invalid url", { status: 400 });
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return new Response("Invalid url", { status: 400 });
  }

  const supabase = createServiceClient();
  const emailJobId = trackingId.replace(/^emailjob-/, "");

  // Record click event (best-effort)
  try {
    const { data: job } = await supabase
      .from("email_jobs")
      .select("id, campaigns(user_id), leads(email)")
      .eq("id", emailJobId)
      .maybeSingle();

    if (job) {
      const j = job as any;
      await supabase.from("email_events").insert({
        email_job_id: j.id,
        type: "click",
        meta: {
          url: target.toString(),
          user_agent: request.headers.get("user-agent") || "",
          ip: request.headers.get("x-forwarded-for") || "",
        },
      });
      await createAuditLog(j.campaigns?.user_id || null, "email_clicked", {
        jobId: j.id,
        leadEmail: j.leads?.email,
        url: target.toString(),
      });
    }
  } catch {
    // Swallow errors; still redirect
  }

  return NextResponse.redirect(target.toString());
}
