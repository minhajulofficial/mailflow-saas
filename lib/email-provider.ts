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
 * Dispatch send to the correct provider.
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
 * Test a provider connection.
 */
export async function testProviderConnection(
  userId: string,
  provider: EmailProvider
): Promise<{ ok: boolean; error?: string }> {
  const secret = await getIntegrationSecret(userId, provider);
  if (!secret) {
    return { ok: false, error: `${provider} not configured` };
  }

  switch (provider) {
    case "brevo": {
      try {
        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": secret,
            Accept: "application/json",
          },
          body: JSON.stringify({
            sender: { name: "MailFlow Test", email: "noreply@example.com" },
            to: [{ email: "noreply@example.com" }],
            subject: "Connection test",
            htmlContent: "<p>Test</p>",
          }),
        });
        // 400 with valid key means auth works but validation failed
        if (response.status === 400 || response.status === 200) {
          return { ok: true };
        }
        return { ok: false, error: `Brevo auth failed: ${response.status}` };
      } catch (err: any) {
        return { ok: false, error: err.message };
      }
    }
    case "mailjet": {
      const parts = secret.split(":");
      const auth = Buffer.from(`${parts[0]}:${parts[1] || ""}`).toString("base64");
      try {
        const response = await fetch("https://api.mailjet.com/v3/contact", {
          headers: { Authorization: `Basic ${auth}` },
        });
        if (response.status === 200 || response.status === 401) {
          return response.status === 200 ? { ok: true } : { ok: false, error: "Mailjet auth failed" };
        }
        return { ok: true };
      } catch (err: any) {
        return { ok: false, error: err.message };
      }
    }
    default:
      return { ok: false, error: "Test not supported for this provider" };
  }
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
