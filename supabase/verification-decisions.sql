-- Admin payment decisions: Accepted / Declined / Unsuccessful.
-- Run once in the Supabase SQL editor.
--
-- registrations.status keeps its existing values, which the rest of the app
-- (scanner, My Tickets, payments) already understands:
--   accepted     -> status 'paid'
--   declined     -> status 'failed'   (not a legit customer / bad proof)
--   unsuccessful -> status 'failed'   (payment never reached the account)
-- This column records which of the two 'failed' outcomes it was.

alter table public.registrations
  add column if not exists verification_decision text;

alter table public.registrations
  drop constraint if exists registrations_verification_decision_check;
alter table public.registrations
  add constraint registrations_verification_decision_check
  check (verification_decision is null
         or verification_decision in ('accepted', 'declined', 'unsuccessful'));

-- Backfill decisions already made through the old Verify / Failed buttons.
update public.registrations
set verification_decision = case status when 'paid' then 'accepted' else 'declined' end
where verification_decision is null
  and verified_by is not null
  and status in ('paid', 'failed');
