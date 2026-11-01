import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Security headers middleware - applied to all responses
export function securityHeadersMiddleware(request: NextRequest, response: NextResponse) {
  const headers = new Headers(response.headers);

  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'none';"
  );
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );

  // HSTS only in production
  if (process.env.NODE_ENV === "production") {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  return new NextResponse(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isBlockedIPv4(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) {
    return false;
  }

  const [a, b, c, d] = parts.map(Number);
  if ([a, b, c, d].some((octet) => octet > 255)) return true;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}

function isBlockedIPv6(hostname: string): boolean {
  const address = hostname.toLowerCase();
  if (address === "::" || address === "::1") return true;
  // Reject IPv4-mapped IPv6 entirely; it can encode private IPv4 destinations.
  if (address.startsWith("::ffff:")) return true;
  const firstGroup = Number.parseInt(address.split(":")[0] || "0", 16);
  return (
    (firstGroup >= 0xfc00 && firstGroup <= 0xfdff) || // unique-local
    (firstGroup >= 0xfe80 && firstGroup <= 0xfebf) || // link-local
    (firstGroup >= 0xfec0 && firstGroup <= 0xfeff) || // deprecated site-local
    firstGroup >= 0xff00 // multicast
  );
}

export function isSSRFUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;
    if (parsed.username || parsed.password) return true;

    const hostname = parsed.hostname
      .toLowerCase()
      .replace(/^\[|\]$/g, "")
      .replace(/\.$/, "");
    if (
      !hostname ||
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      isBlockedIPv4(hostname) ||
      (hostname.includes(":") && isBlockedIPv6(hostname))
    ) {
      return true;
    }

    return false;
  } catch {
    return true;
  }
}
