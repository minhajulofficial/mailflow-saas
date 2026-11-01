import { timingSafeEqual } from "node:crypto";

const MIN_SECRET_BYTES = 32;

export function isAuthorizedWorker(request: Request): boolean {
  const expectedSecret = process.env.WORKER_API_SECRET;
  if (!expectedSecret || Buffer.byteLength(expectedSecret, "utf8") < MIN_SECRET_BYTES) {
    return false;
  }

  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([^\s]+)$/.exec(authorization);
  if (!match) return false;

  const expected = Buffer.from(expectedSecret, "utf8");
  const supplied = Buffer.from(match[1], "utf8");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
