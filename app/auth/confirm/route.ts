import { createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Handles links Supabase sends by email:
 *  - email confirmation (signup)
 *  - magic links
 *  - password recovery (PKCE `code` or `token_hash`)
 *
 * Supabase's Site URL / Redirect URLs must include `<origin>/auth/confirm`.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next");
  const next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/app";

  const supabase = await createServerClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(error.message)}`,
        url.origin
      )
    );
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(error.message)}`,
        url.origin
      )
    );
  }

  return NextResponse.redirect(
    new URL("/login?error=Invalid%20confirmation%20link", url.origin)
  );
}
