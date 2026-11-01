import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/encryption";
import { isSSRFUrl } from "@/lib/security";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("secret encryption", () => {
  it("uses a fresh 96-bit nonce and round-trips with authenticated encryption", () => {
    const encrypted = encryptSecret("provider-token-value");

    expect(Buffer.from(encrypted.iv, "base64")).toHaveLength(12);
    expect(decryptSecret(encrypted)).toBe("provider-token-value");
  });

  it("rejects ciphertext tampering", () => {
    const encrypted = encryptSecret("provider-token-value");
    const tampered = {
      ...encrypted,
      ciphertext: `${encrypted.ciphertext.slice(0, -2)}AA`,
    };

    expect(() => decryptSecret(tampered)).toThrow();
  });
});

describe("user-supplied URL screening", () => {
  it.each([
    "http://localhost/",
    "http://127.0.0.1/",
    "http://0.0.0.0/",
    "http://169.254.169.254/latest/meta-data/",
    "http://192.168.1.20/",
    "http://172.31.255.255/",
    "http://[::1]/",
    "http://[fc00::1]/",
    "http://[fe80::1]/",
    "http://user:pass@example.com/",
  ])("blocks unsafe URL %s", (url) => {
    expect(isSSRFUrl(url)).toBe(true);
  });

  it("allows a public HTTPS URL", () => {
    expect(isSSRFUrl("https://example.com/contacts")).toBe(false);
  });
});
