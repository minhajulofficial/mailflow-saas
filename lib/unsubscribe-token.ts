import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed tokens for one-click unsubscribe links. Without a signature anyone
 * could unsubscribe arbitrary addresses by hitting the endpoint directly.
 */
function secretKey(): string | null {
  const key =
    process.env.UNSUBSCRIBE_SECRET ||
    process.env.ENCRYPTION_MASTER_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  return key && key.length >= 16 ? key : null;
}

function payloadFor(email: string, jobId?: string | null) {
  return `${email.trim().toLowerCase()}|${jobId || ""}`;
}

export function signUnsubscribeToken(email: string, jobId?: string | null): string {
  const key = secretKey();
  if (!key) return "";
  return createHmac("sha256", key)
    .update(payloadFor(email, jobId))
    .digest("base64url");
}

export function verifyUnsubscribeToken(
  email: string,
  jobId: string | null | undefined,
  token: string | null | undefined
): boolean {
  const key = secretKey();
  if (!key || !token) return false;

  const expected = Buffer.from(signUnsubscribeToken(email, jobId), "utf8");
  const supplied = Buffer.from(token, "utf8");
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}
