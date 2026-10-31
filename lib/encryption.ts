import { AES, enc } from "crypto-js";

const MASTER_KEY_B64 = process.env.ENCRYPTION_MASTER_KEY;

if (!MASTER_KEY_B64) {
  throw new Error("ENCRYPTION_MASTER_KEY environment variable is required");
}

const masterKey = enc.Base64.parse(MASTER_KEY_B64);

export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
}

export function encryptSecret(plaintext: string): EncryptedSecret {
  const iv = enc.Utf8.parse(Math.random().toString(36).substring(2, 18));
  const encrypted = AES.encrypt(plaintext, masterKey, { iv });
  return {
    ciphertext: encrypted.toString(),
    iv: iv.toString(),
  };
}

export function decryptSecret(encrypted: EncryptedSecret): string {
  const decrypted = AES.decrypt(encrypted.ciphertext, masterKey, {
    iv: enc.Utf8.parse(encrypted.iv),
  });
  return decrypted.toString(enc.Utf8);
}

export function maskSecret(plaintext: string): string {
  if (!plaintext || plaintext.length < 8) {
    return "••••••••";
  }
  const visible = plaintext.slice(-4);
  return `••••••${visible}`;
}
