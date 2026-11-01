import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  const trackingId = request.nextUrl.pathname.split("/").pop();
  if (!url) return new Response("Missing url", { status: 400 });
  return NextResponse.redirect(decodeURIComponent(url));
}
