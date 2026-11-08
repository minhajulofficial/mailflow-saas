import { NextResponse } from "next/server";
import { isAuthorizedWorker } from "@/lib/worker-auth";
import { processDueEmailJobs } from "@/lib/process-email-jobs";

/**
 * Background worker endpoint: processes due email jobs.
 * Called by Vercel Cron, Inngest, Trigger.dev, or an external scheduler.
 * Requires Bearer WORKER_API_SECRET authorization.
 */
export async function POST(request: Request) {
  if (!isAuthorizedWorker(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.APP_URL || new URL(request.url).origin;

  try {
    const result = await processDueEmailJobs({ limit: 50, appUrl });
    return NextResponse.json({
      ...result,
      message: `Processed ${result.processed} jobs (${result.succeeded} sent, ${result.failed} failed/retried)`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Worker failed" },
      { status: 500 }
    );
  }
}
