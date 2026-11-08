import { NextResponse, type NextRequest } from "next/server";
import { createServerClient as _createServerClient } from "@supabase/ssr";
import { securityHeadersMiddleware } from "@/lib/security";

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Apply security headers
  const securedResponse = securityHeadersMiddleware(request, response);

  if (!supabaseUrl || !supabaseAnonKey) {
    return securedResponse;
  }

  const supabase = _createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        securedResponse.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        securedResponse.cookies.set({ name, value: "", ...options });
      },
    },
  });

  const { pathname } = request.nextUrl;

  // Protect /app routes - require authentication
  if (pathname.startsWith("/app")) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirectTo", pathname);
      const redirectResponse = NextResponse.redirect(loginUrl);
      securedResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie);
      });
      return securityHeadersMiddleware(request, redirectResponse);
    }
  }

  return securedResponse;
}

export const config = {
  matcher: ["/app/:path*", "/api/extract/:path*", "/api/leads/:path*", "/api/send/:path*"],
};
