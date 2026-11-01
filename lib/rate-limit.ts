import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { securityHeadersMiddleware } from "@/lib/security";

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = {
  login: 10,
  extract: 5,
  email: 30,
  export: 10,
  webhook: 100,
};

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(identifier: string, limit: number): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: limit - 1 };
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: limit - record.count };
}

export async function rateLimitMiddleware(
  request: NextRequest,
  endpoint: keyof typeof RATE_LIMIT_MAX
) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const identifier = `${ip}:${endpoint}`;
  const result = checkRateLimit(identifier, RATE_LIMIT_MAX[endpoint]);

  if (!result.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again later." },
      { status: 429 }
    );
  }

  return null;
}

export { securityHeadersMiddleware };
