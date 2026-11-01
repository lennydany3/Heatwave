-- Seat limits per ticket tier + waitlist.
-- Run once in the Supabase SQL editor.

-- 1. Seat limit per tier (null = unlimited). Registrations count against it while
--    they're pending or accepted; declined / unsuccessful ones free their seat.
alter table public.ticket_tiers
  add column if not exists seat_limit integer;

alter table public.ticket_tiers
  drop constraint if exists ticket_tiers_seat_limit_check;
alter table public.ticket_tiers
  add constraint ticket_tiers_seat_limit_check check (seat_limit is null or seat_limit >= 0);

-- 2. Waitlist. Shown when a tier is full or manually closed.
--    waiting    = in the queue
--    invited    = admin released a seat for them (they can register and it's held for them)
--    registered = they went on to register
create table if not exists public.waitlist (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events (id) on delete cascade,
  ticket_tier_id uuid references public.ticket_tiers (id) on delete set null,
  user_id        uuid references auth.users (id) on delete set null,
  full_name      text not null,
  email          text not null,
  mobile         text not null,
  instagram      text,
  age            integer,
  gender         text,
  status         text not null default 'waiting'
                 check (status in ('waiting', 'invited', 'registered')),
  created_at     timestamptz not null default now()
);

create unique index if not exists waitlist_event_email_key
  on public.waitlist (event_id, lower(email));

-- No policies on purpose: every read/write goes through the app's API routes with
-- the service-role key, so the table stays closed to browsers.
alter table public.waitlist enable row level security;

-- Example: cap Early Bird at 30 seats.
-- update public.ticket_tiers set seat_limit = 30 where code = 'early_bird';
