import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { processDueEmailJobs } from "@/lib/process-email-jobs";

/**
 * Vercel Cron entry point. Vercel calls this with
 * `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is configured.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET || process.env.WORKER_API_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET or WORKER_API_SECRET is not configured" },
      { status: 503 }
    );
  }

  const header = request.headers.get("authorization") || "";
  const supplied = header.replace(/^Bearer\s+/i, "");
  const expected = Buffer.from(secret, "utf8");
  const actual = Buffer.from(supplied, "utf8");

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.APP_URL || new URL(request.url).origin;

  try {
    const result = await processDueEmailJobs({ limit: 50, appUrl });
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Cron failed" },
      { status: 500 }
    );
  }
}
