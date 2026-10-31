import { NextResponse } from "next/server";
import type { NextRequest } from "next/request";
import { createServerClient } from "@supabase/ssr";
import { securityHeadersMiddleware, isSSRFUrl } from "@/lib/security";
import { rateLimitMiddleware } from "@/lib/rate-limit";

export function middleware(request: NextRequest) {
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

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
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

  const pathname = request.nextUrl.pathname;

  // Protect /app routes - require authentication
  if (pathname.startsWith("/app")) {
    const { data } = supabase.auth.getUser();
    if (!data.user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return securedResponse;
}

export const config = {
  matcher: ["/app/:path*", "/api/extract/:path*", "/api/leads/:path*", "/api/send/:path*"],
};
