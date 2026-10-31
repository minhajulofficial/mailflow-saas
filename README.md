# MailFlow SaaS

Secure B2B lead extraction + cold email outreach platform built with Next.js 15, Supabase, and TypeScript.

## Features
- Google OAuth authentication
- Multi-tenant data isolation with Row Level Security
- Apify-powered lead extraction with webhook processing
- AES-256-GCM encrypted API key vault
- Cold email campaigns with Brevo, Mailjet, Gmail SMTP
- AI template generation (server-side)
- Email tracking (open, click, reply, bounce)
- Analytics dashboard
- CSV export/import

## Setup

1. Copy `.env.example` to `.env.local` and fill in your values.
2. Generate encryption master key:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
3. Install dependencies: `npm install`
4. Run dev server: `npm run dev`
5. Run migrations: `npm run db:migrate`

## Security
- All API keys encrypted at rest (AES-256-GCM)
- RLS enabled on all database tables
- Webhook signature verification
- SSRF protection on user-supplied URLs
- Rate limiting on sensitive endpoints
