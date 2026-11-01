import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get("email");
  const token = request.nextUrl.searchParams.get("token");
  return NextResponse.redirect(`${request.nextUrl.origin}/unsubscribed?email=${email}`);
}
