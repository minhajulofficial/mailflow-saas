import { NextResponse } from "next/server";

export async function GET(request: { nextUrl: { origin: string; searchParams: { get: (key: string) => string | null } } }) {
  const url = request.nextUrl.searchParams.get("url");
  const trackingId = request.nextUrl.pathname.split("/").pop();
  if (!url) return new Response("Missing url", { status: 400 });
  return NextResponse.redirect(decodeURIComponent(url));
}
