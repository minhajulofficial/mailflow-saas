import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const CIPHERTEXT_PREFIX = "v1";

export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
}

function getMasterKey(): Buffer {
  const encodedKey = process.env.ENCRYPTION_MASTER_KEY;
  if (!encodedKey) {
    throw new Error("ENCRYPTION_MASTER_KEY environment variable is required");
  }

  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== KEY_BYTES || key.toString("base64") !== encodedKey) {
    throw new Error("ENCRYPTION_MASTER_KEY must be a canonical base64-encoded 32-byte key");
  }
  return key;
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
