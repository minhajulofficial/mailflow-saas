export const APP_LIMITS = {
  MAX_LEADS_PER_EXTRACTION: 1000,
  MAX_URLS_PER_EXTRACTION: 100,
  MAX_CAMPAIGN_STEPS: 5,
  MAX_RECIPIENTS_PER_CAMPAIGN: 10000,
  DAILY_EMAIL_DEFAULT_LIMIT: 50,
  HOURLY_EMAIL_DEFAULT_LIMIT: 10,
  MIN_DELAY_SECONDS: 30,
  MAX_DELAY_SECONDS: 3600,
} as const;

export const PROVIDERS = {
  BREVO: "brevo",
  MAILJET: "mailjet",
  GMAIL: "gmail",
  SMTP: "smtp",
} as const;

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "replied",
  "interested",
  "won",
  "lost",
] as const;

export const EMAIL_STATUSES = [
  "unverified",
  "valid",
  "risky",
  "invalid",
] as const;

export const JOB_STATUSES = [
  "queued",
  "running",
  "completed",
  "failed",
] as const;

export const CAMPAIGN_STATUSES = [
  "draft",
  "scheduled",
  "sending",
  "paused",
  "completed",
  "cancelled",
] as const;

export const EVENT_TYPES = [
  "queued",
  "sent",
  "delivered",
  "open",
  "click",
  "reply",
  "bounce",
  "spam",
  "unsub",
] as const;
