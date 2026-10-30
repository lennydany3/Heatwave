-- Manual UPI payments + one registration per account.
-- Run once in the Supabase SQL editor.

-- 1. Private bucket for UPI payment screenshots.
--    No storage policies are added on purpose: uploads (registration API) and
--    reads (admin verification API, via signed URLs) both go through the
--    service-role key, so the bucket stays closed to every client.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  5242880, -- 5 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
set public             = excluded.public,
    file_size_limit    = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- 2. UPI + verification columns on registrations.
--    status keeps its existing values:
--      pending = submitted, waiting for admin verification
--      paid    = verified by admin
--      failed  = rejected by admin (verification_note holds the reason)
alter table public.registrations
  add column if not exists upi_txn_id         text,
  add column if not exists payment_proof_path text,
  add column if not exists verification_note  text,
  add column if not exists verified_at        timestamptz,
  add column if not exists verified_by        uuid references auth.users (id);

alter table public.registrations
  drop constraint if exists registrations_upi_txn_id_format;
alter table public.registrations
  add constraint registrations_upi_txn_id_format
  check (upi_txn_id is null or upi_txn_id ~ '^[0-9]{12}$');

-- A UPI transaction ID can only be claimed once.
create unique index if not exists registrations_upi_txn_id_key
  on public.registrations (upi_txn_id)
  where upi_txn_id is not null;

-- 3. One registration per account per event.
--    Abandoned Razorpay checkouts (no ticket issued) would block the unique
--    index below, so retire them first.
update public.registrations r
set status = 'cancelled'
where r.status in ('pending', 'failed')
  and r.upi_txn_id is null
  and not exists (select 1 from public.tickets t where t.registration_id = r.id);

-- Accounts that already hold more than one live registration (e.g. several
-- Razorpay test bookings) keep exactly one: paid first, then pending, then
-- failed, newest first. The rest — and their tickets — are cancelled, not
-- deleted, so nothing is lost.
with ranked as (
  select id,
         row_number() over (
           partition by user_id, event_id
           order by case status when 'paid' then 0 when 'pending' then 1 else 2 end,
                    created_at desc
         ) as rn
  from public.registrations
  where status <> 'cancelled'
),
extra as (
  update public.registrations r
  set status = 'cancelled'
  from ranked
  where r.id = ranked.id and ranked.rn > 1
  returning r.id
)
update public.tickets t
set status = 'cancelled'
from extra
where t.registration_id = extra.id;

create unique index if not exists registrations_one_per_user_event
  on public.registrations (user_id, event_id)
  where status <> 'cancelled';
