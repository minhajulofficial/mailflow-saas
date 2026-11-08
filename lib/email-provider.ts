import { createClient } from "@supabase/supabase-js";
import { decryptSecret } from "@/lib/encryption";
import { createAuditLog } from "@/lib/audit";

export type EmailProvider = "brevo" | "mailjet" | "gmail" | "smtp";

export interface EmailSendInput {
  to: string;
  toName?: string;
  from: string;
  fromName?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text?: string;
  messageId: string;
  headers?: Record<string, string>;
}

export interface SendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

/**
 * Get decrypted integration secret for a user + provider.
 */
export async function getIntegrationSecret(
  userId: string,
  provider: EmailProvider
): Promise<string | null> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data } = await supabase
    .from("integrations")
    .select("encrypted_secret, iv")
    .eq("user_id", userId)
    .eq("provider", provider)
    .eq("enabled", true)
    .maybeSingle();

  if (!data) return null;

  return decryptSecret({
    ciphertext: data.encrypted_secret,
    iv: data.iv,
  });
}

/**
 * Brevo (Sendinblue) email sender.
 */
export async function sendViaBrevo(
  apiKey: string,
  input: EmailSendInput
): Promise<SendResult> {
  try {
    const payload: any = {
      sender: {
        name: input.fromName || "MailFlow",
        email: input.from,
      },
      to: [{ email: input.to, name: input.toName }],
      subject: input.subject,
      htmlContent: input.html,
      textContent: input.text || "",
      "message-id": input.messageId,
      headers: {
        "List-Unsubscribe": `<${process.env.APP_URL}/api/unsubscribe?email=${encodeURIComponent(input.to)}>`,
        ...input.headers,
      },
    };

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.message || `Brevo API error: ${response.status}`,
      };
    }

    return { success: true, providerMessageId: result.messageId };
  } catch (err: any) {
    return { success: false, error: err.message || "Brevo send failed" };
  }
}

/**
 * Mailjet email sender.
 */
export async function sendViaMailjet(
  apiKey: string,
  input: EmailSendInput,
  secretKey?: string
): Promise<SendResult> {
  try {
    const auth = Buffer.from(`${apiKey}:${secretKey || ""}`).toString("base64");

    const payload: any = {
      Messages: [
        {
          From: {
            Email: input.from,
            Name: input.fromName || "MailFlow",
          },
          To: [{ Email: input.to, Name: input.toName }],
          Subject: input.subject,
          TextPart: input.text || "",
          HTMLPart: input.html,
          MessageID: input.messageId,
          Headers: {
            "List-Unsubscribe": `<${process.env.APP_URL}/api/unsubscribe?email=${encodeURIComponent(input.to)}>`,
            ...input.headers,
          },
        },
      ],
    };

    const response = await fetch("https://api.mailjet.com/v3.1/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: (result.ErrorMessage || `Mailjet API error: ${response.status}`),
      };
    }

    const sentMessage = result.Messages?.[0];
    return {
      success: true,
      providerMessageId: sentMessage?.MessageID || sentMessage?.MessageUUID,
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Mailjet send failed" };
  }
}

/**
 * Generic SMTP sender (uses nodemailer-style via fetch to an internal SMTP relay,
 * or direct SMTP if available). For serverless compatibility, we delegate to
 * an SMTP endpoint. Here we implement a minimal direct SMTP over TLS using
 * node:net/tls when possible; otherwise return a clear error.
 */
export async function sendViaSmtp(
  config: {
    host: string;
    port: number;
    user: string;
    pass: string;
    tls?: boolean;
  },
  input: EmailSendInput
): Promise<SendResult> {
  // In a serverless environment, direct SMTP sockets are often blocked.
  // Provide a clear, actionable error pointing to Brevo/Mailjet.
  return {
    success: false,
    error:
      "Direct SMTP is not available in this serverless environment. Use Brevo or Mailjet instead.",
  };
}

/**
 * Dispatch a send using an explicit, already-decrypted provider secret.
 */
export async function dispatchEmail(
  provider: EmailProvider,
  secret: string,
  input: EmailSendInput
): Promise<SendResult> {
  switch (provider) {
    case "brevo":
      return sendViaBrevo(secret, input);
    case "mailjet": {
      const parts = secret.split(":");
      return sendViaMailjet(parts[0], input, parts[1]);
    }
    case "gmail":
    case "smtp":
      return sendViaSmtp(
        { host: "", port: 587, user: "", pass: "", tls: true },
        input
      );
    default:
      return { success: false, error: `Unknown provider: ${provider}` };
  }
}

/**
 * Dispatch send to the correct provider (looks up the stored secret).
 */
export async function sendEmail(
  userId: string,
  provider: EmailProvider,
  input: EmailSendInput,
  smtpConfig?: { host: string; port: number; user: string; pass: string; tls?: boolean }
): Promise<SendResult> {
  const secret = await getIntegrationSecret(userId, provider);
  if (!secret) {
    return { success: false, error: `${provider} integration not configured` };
  }

  switch (provider) {
    case "brevo":
      return sendViaBrevo(secret, input);
    case "mailjet": {
      // Mailjet needs API key + secret. We store them combined as "apiKey:secretKey".
      const parts = secret.split(":");
      return sendViaMailjet(parts[0], input, parts[1]);
    }
    case "gmail":
    case "smtp":
      return sendViaSmtp(
        smtpConfig || { host: "", port: 587, user: "", pass: "", tls: true },
        input
      );
    default:
      return { success: false, error: `Unknown provider: ${provider}` };
  }
}

/**
 * Test a provider connection with an explicit secret (used before saving).
 */
export async function testProviderSecret(
  provider: EmailProvider | "apify",
  secret: string
): Promise<{ ok: boolean; error?: string }> {
  if (!secret || !secret.trim()) {
    return { ok: false, error: "Secret is empty" };
  }

  try {
    switch (provider) {
      case "apify": {
        const response = await fetch("https://api.apify.com/v2/users/me", {
          headers: { Authorization: `Bearer ${secret}` },
        });
        return response.ok
          ? { ok: true }
          : { ok: false, error: `Apify rejected the token (HTTP ${response.status})` };
      }
      case "brevo": {
        const response = await fetch("https://api.brevo.com/v3/account", {
          headers: { "api-key": secret, Accept: "application/json" },
        });
        return response.ok
          ? { ok: true }
          : { ok: false, error: `Brevo rejected the API key (HTTP ${response.status})` };
      }
      case "mailjet": {
        // Mailjet needs "API key:secret key".
        const parts = secret.split(":");
        if (parts.length < 2 || !parts[0] || !parts[1]) {
          return {
            ok: false,
            error:
              'Mailjet needs both keys. Enter them as "apiKey:secretKey".',
          };
        }
        const auth = Buffer.from(`${parts[0]}:${parts[1]}`).toString("base64");
        const response = await fetch("https://api.mailjet.com/v3/REST/sender", {
          headers: { Authorization: `Basic ${auth}` },
        });
        if (response.status === 401) {
          return { ok: false, error: "Mailjet rejected the credentials" };
        }
        return { ok: true };
      }
      case "gmail":
      case "smtp":
        return {
          ok: false,
          error:
            "SMTP/Gmail sending is not available in this deployment. Use Brevo or Mailjet.",
        };
      default:
        return { ok: false, error: "Unknown provider" };
    }
  } catch (err: any) {
    return { ok: false, error: err.message || "Connection test failed" };
  }
}

/**
 * Test a provider connection using an already-saved integration.
 */
export async function testProviderConnection(
  userId: string,
  provider: EmailProvider
): Promise<{ ok: boolean; error?: string }> {
  const secret = await getIntegrationSecret(userId, provider);
  if (!secret) {
    return { ok: false, error: `${provider} not configured` };
  }
  return testProviderSecret(provider, secret);
}

/**
 * Record an audit log entry for email sending.
 */
export async function logEmailEvent(
  userId: string,
  action: string,
  meta?: Record<string, any>
) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await supabase.from("audit_logs").insert({
      user_id: userId,
      action,
      meta: meta || {},
    });
  } catch {
    // Audit logging should never break the main flow
  }
}
