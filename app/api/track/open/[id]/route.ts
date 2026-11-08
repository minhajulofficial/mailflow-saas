import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createAuditLog } from "@/lib/audit";

const trackingPixel = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export async function GET(request: NextRequest) {
  const trackingId = request.nextUrl.pathname.split("/").pop();
  if (!trackingId) {
    return new Response(trackingPixel, {
      headers: { "Content-Type": "image/gif", "Cache-Control": "no-cache" },
    });
  }

  const supabase = createServiceClient();

  // Parse email_job_id from tracking id (format: emailjob-{uuid} or just uuid)
  const emailJobId = trackingId.replace(/^emailjob-/, "");

  // Record the open event (best-effort; don't fail the pixel response)
  try {
    const { data: job } = await supabase
      .from("email_jobs")
      .select("id, campaigns(user_id), leads(email)")
      .eq("id", emailJobId)
      .maybeSingle();

    if (job) {
      await supabase.from("email_events").insert({
        email_job_id: job.id,
        type: "open",
        meta: {
          user_agent: request.headers.get("user-agent") || "",
          ip: request.headers.get("x-forwarded-for") || "",
        },
      });
      await createAuditLog((job as any).campaigns?.user_id || null, "email_opened", {
        jobId: job.id,
        leadEmail: (job as any).leads?.email,
      });
    }
  } catch {
    // Swallow errors so the pixel still loads
  }

  return new Response(trackingPixel, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}

export const dynamic = "force-dynamic";
