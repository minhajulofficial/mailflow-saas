import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const trackingId = request.nextUrl.pathname.split("/").pop();
  // Record open event via /api/email-events then serve 1x1 pixel
  return new Response(Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"), {
    headers: { "Content-Type": "image/gif", "Cache-Control": "no-cache, no-store, must-revalidate" },
  });
}

export const dynamic = "force-dynamic";
