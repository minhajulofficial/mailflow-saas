import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const CIPHERTEXT_PREFIX = "v1";

export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
}

let warnedFallback = false;

function parseMasterKey(encodedKey: string): Buffer | null {
  try {
    const key = Buffer.from(encodedKey, "base64");
    if (key.length !== KEY_BYTES || key.toString("base64") !== encodedKey) {
      return null;
    }
    return key;
  } catch {
    return null;
  }
}

/**
 * Deterministic fallback key derived from the service-role key. Used only when
 * ENCRYPTION_MASTER_KEY is unset or still a placeholder, so secret storage
 * keeps working out of the box instead of failing every write with a 500.
 * The derivation is stable, so previously stored values still decrypt.
 */
function deriveFallbackKey(serviceRoleKey: string): Buffer {
  return createHmac("sha256", serviceRoleKey)
    .update("mailflow:encryption-key:v1")
    .digest();
}

function getMasterKey(): Buffer {
  const encodedKey = process.env.ENCRYPTION_MASTER_KEY;
  const parsed = encodedKey ? parseMasterKey(encodedKey) : null;
  if (parsed) return parsed;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRoleKey && serviceRoleKey.length >= 16) {
    if (!warnedFallback) {
      warnedFallback = true;
      console.warn(
        "[encryption] ENCRYPTION_MASTER_KEY is missing or invalid; deriving the storage key from SUPABASE_SERVICE_ROLE_KEY. Set a real base64 32-byte ENCRYPTION_MASTER_KEY to use a dedicated key."
      );
    }
    return deriveFallbackKey(serviceRoleKey);
  }

  throw new Error(
    "No encryption key available: set ENCRYPTION_MASTER_KEY (canonical base64, 32 bytes) or SUPABASE_SERVICE_ROLE_KEY"
  );
}

export function encryptSecret(plaintext: string): EncryptedSecret {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", getMasterKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: `${CIPHERTEXT_PREFIX}.${ciphertext.toString("base64")}.${authTag.toString("base64")}`,
    iv: iv.toString("base64"),
  };
}

export function decryptSecret(encrypted: EncryptedSecret): string {
  const [version, ciphertextBase64, authTagBase64, extra] = encrypted.ciphertext.split(".");
  if (
    version !== CIPHERTEXT_PREFIX ||
    !ciphertextBase64 ||
    !authTagBase64 ||
    extra !== undefined
  ) {
    throw new Error("Secret uses an unsupported encryption format; save the integration key again");
  }

  const iv = Buffer.from(encrypted.iv, "base64");
  const ciphertext = Buffer.from(ciphertextBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  if (
    iv.length !== IV_BYTES ||
    authTag.length !== TAG_BYTES ||
    iv.toString("base64") !== encrypted.iv ||
    ciphertext.toString("base64") !== ciphertextBase64 ||
    authTag.toString("base64") !== authTagBase64
  ) {
    throw new Error("Encrypted secret is malformed");
  }

  try {
    const decipher = createDecipheriv("aes-256-gcm", getMasterKey(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Unable to decrypt secret; it may be corrupted or use an unsupported key");
  }
}

export function maskSecret(plaintext: string): string {
  if (!plaintext || plaintext.length < 8) {
    return "••••••••";
  }
  const visible = plaintext.slice(-4);
  return `••••••${visible}`;
}
