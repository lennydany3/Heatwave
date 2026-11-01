-- One-time codes for email OTP sign-up / log-in (sent through Resend).
-- Run once in the Supabase SQL editor.
--
-- Only a keyed hash of each code is stored, never the code itself. Rows are
-- short-lived: they expire after 10 minutes and are deleted once used.
create table if not exists public.auth_otps (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  purpose    text not null check (purpose in ('login', 'signup')),
  code_hash  text not null,
  attempts   integer not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists auth_otps_email_idx on public.auth_otps (email, purpose, created_at desc);

-- No policies on purpose: only the app's API routes (service-role key) touch this table.
alter table public.auth_otps enable row level security;
