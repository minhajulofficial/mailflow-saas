import { NextResponse } from "next/server";

export async function GET(request: { nextUrl: { searchParams: { get: (key: string) => string | null } } }) {
  const email = request.nextUrl.searchParams.get("email");
  const token = request.nextUrl.searchParams.get("token");
  return NextResponse.redirect(`${request.nextUrl.origin}/unsubscribed?email=${email}`);
}
