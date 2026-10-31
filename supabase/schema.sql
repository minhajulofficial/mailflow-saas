-- Enable Row Level Security on all tables by default
-- Tables: profiles, integrations, sender_accounts, lead_lists, extraction_jobs,
-- leads, templates, campaigns, campaign_steps, email_jobs, email_events,
-- replies, suppression_list, audit_logs

-- ============================================
-- profiles
-- ============================================
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  name text,
  avatar text,
  plan text default 'free',
  sender_address text,
  timezone text default 'UTC',
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- integrations (API keys, encrypted)
-- ============================================
create table if not exists public.integrations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  encrypted_secret text not null,
  iv text not null,
  label text,
  enabled boolean default true,
  status text default 'pending',
  last_tested_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.integrations enable row level security;

create policy "Users can manage own integrations"
  on public.integrations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_integrations_user_id on public.integrations(user_id);
create index idx_integrations_provider on public.integrations(provider);

-- ============================================
-- sender_accounts
-- ============================================
create table if not exists public.sender_accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  integration_id uuid references public.integrations(id) on delete set null,
  from_name text not null,
  from_email text not null,
  reply_to text,
  signature text,
  daily_limit integer default 50,
  hourly_limit integer default 10,
  min_delay integer default 30,
  max_delay integer default 120,
  warmup_stage integer default 1,
  enabled boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.sender_accounts enable row level security;

create policy "Users can manage own sender accounts"
  on public.sender_accounts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_sender_accounts_user_id on public.sender_accounts(user_id);

-- ============================================
-- lead_lists
-- ============================================
create table if not exists public.lead_lists (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

alter table public.lead_lists enable row level security;

create policy "Users can manage own lead lists"
  on public.lead_lists for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_lead_lists_user_id on public.lead_lists(user_id);

-- ============================================
-- extraction_jobs
-- ============================================
create table if not exists public.extraction_jobs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  params jsonb not null,
  actor text,
  apify_run_id text,
  status text default 'queued',
  progress integer default 0,
  result_count integer default 0,
  error text,
  created_at timestamptz default now(),
  finished_at timestamptz
);

alter table public.extraction_jobs enable row level security;

create policy "Users can manage own extraction jobs"
  on public.extraction_jobs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_extraction_jobs_user_id on public.extraction_jobs(user_id);
create index idx_extraction_jobs_status on public.extraction_jobs(status);

-- ============================================
-- leads
-- ============================================
create table if not exists public.leads (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  list_id uuid references public.lead_lists(id) on delete set null,
  job_id uuid references public.extraction_jobs(id) on delete set null,
  person_name text,
  designation text,
  company text,
  website text,
  email text,
  email_status text default 'unverified',
  phone text,
  facebook text,
  instagram text,
  linkedin text,
  youtube text,
  x_url text,
  tiktok text,
  country text,
  state text,
  city text,
  address text,
  niche text,
  source text,
  tags text[] default '{}',
  status text default 'new',
  collected_at timestamptz default now(),
  created_at timestamptz default now()
);

alter table public.leads enable row level security;

create policy "Users can manage own leads"
  on public.leads for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_leads_user_id_collected on public.leads(user_id, collected_at desc);
create index idx_leads_user_id_country_niche on public.leads(user_id, country, niche);
create unique index idx_leads_user_email_unique on public.leads(user_id, lower(email));

-- ============================================
-- templates
-- ============================================
create table if not exists public.templates (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  subject text not null,
  body_html text not null,
  body_text text,
  is_ai boolean default false,
  created_at timestamptz default now()
);

alter table public.templates enable row level security;

create policy "Users can manage own templates"
  on public.templates for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_templates_user_id on public.templates(user_id);

-- ============================================
-- campaigns
-- ============================================
create table if not exists public.campaigns (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  status text default 'draft',
  sender_ids uuid[] default '{}',
  recipient_filter jsonb,
  schedule jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.campaigns enable row level security;

create policy "Users can manage own campaigns"
  on public.campaigns for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_campaigns_user_id on public.campaigns(user_id);
create index idx_campaigns_status on public.campaigns(status);

-- ============================================
-- campaign_steps
-- ============================================
create table if not exists public.campaign_steps (
  id uuid default gen_random_uuid() primary key,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  step_no integer not null,
  template_id uuid references public.templates(id) on delete set null,
  delay_days integer default 0,
  condition jsonb default '{}',
  created_at timestamptz default now()
);

alter table public.campaign_steps enable row level security;

create policy "Users can manage own campaign steps"
  on public.campaign_steps for all
  using (auth.uid() = (select user_id from public.campaigns where id = campaign_id))
  with check (auth.uid() = (select user_id from public.campaigns where id = campaign_id));

create index idx_campaign_steps_campaign_id on public.campaign_steps(campaign_id);

-- ============================================
-- email_jobs
-- ============================================
create table if not exists public.email_jobs (
  id uuid default gen_random_uuid() primary key,
  campaign_id uuid references public.campaigns(id) on delete cascade,
  step_id uuid references public.campaign_steps(id) on delete set null,
  lead_id uuid not null references public.leads(id) on delete cascade,
  sender_id uuid references public.sender_accounts(id) on delete set null,
  message_id text not null,
  status text default 'scheduled',
  scheduled_at timestamptz not null,
  sent_at timestamptz,
  attempts integer default 0,
  error text,
  idempotency_key text not null,
  created_at timestamptz default now()
);

alter table public.email_jobs enable row level security;

create policy "Users can manage own email jobs"
  on public.email_jobs for all
  using (auth.uid() = (select user_id from public.campaigns where id = campaign_id))
  with check (auth.uid() = (select user_id from public.campaigns where id = campaign_id));

create index idx_email_jobs_status_scheduled on public.email_jobs(status, scheduled_at);
create unique index idx_email_jobs_idempotency on public.email_jobs(idempotency_key);

-- ============================================
-- email_events
-- ============================================
create table if not exists public.email_events (
  id uuid default gen_random_uuid() primary key,
  email_job_id uuid not null references public.email_jobs(id) on delete cascade,
  type text not null,
  meta jsonb default '{}',
  occurred_at timestamptz default now()
);

alter table public.email_events enable row level security;

create policy "Users can manage own email events"
  on public.email_events for all
  using (auth.uid() = (select user_id from public.campaigns c join public.email_jobs ej on ej.campaign_id = c.id where ej.id = email_job_id))
  with check (auth.uid() = (select user_id from public.campaigns c join public.email_jobs ej on ej.campaign_id = c.id where ej.id = email_job_id));

create index idx_email_events_job_type on public.email_events(email_job_id, type);

-- ============================================
-- replies
-- ============================================
create table if not exists public.replies (
  id uuid default gen_random_uuid() primary key,
  email_job_id uuid references public.email_jobs(id) on delete set null,
  lead_id uuid not null references public.leads(id) on delete cascade,
  from_email text not null,
  subject text,
  body text,
  received_at timestamptz default now(),
  label text
);

alter table public.replies enable row level security;

create policy "Users can manage own replies"
  on public.replies for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_replies_lead_id on public.replies(lead_id);

-- ============================================
-- suppression_list
-- ============================================
create table if not exists public.suppression_list (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  reason text not null,
  created_at timestamptz default now()
);

alter table public.suppression_list enable row level security;

create policy "Users can manage own suppression list"
  on public.suppression_list for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_suppression_user_email on public.suppression_list(user_id, email);

-- ============================================
-- audit_logs
-- ============================================
create table if not exists public.audit_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  ip text,
  user_agent text,
  meta jsonb default '{}',
  created_at timestamptz default now()
);

alter table public.audit_logs enable row level security;

create policy "Users can view own audit logs"
  on public.audit_logs for select
  using (auth.uid() = user_id);

create index idx_audit_logs_user_id on public.audit_logs(user_id);
create index idx_audit_logs_created_at on public.audit_logs(created_at desc);

-- ============================================
-- service role bypass for webhooks
-- ============================================
-- Webhook endpoints use the service-role key, which bypasses RLS.
-- Never expose the service-role key to the client.
