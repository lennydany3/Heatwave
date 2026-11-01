-- Caseano (Heatwave x Moxie Club) event + ticket tiers.
-- Run once in the Supabase SQL editor. Adjust column names/extra NOT NULL
-- columns if your events / ticket_tiers tables differ from what the app reads.

with ev as (
  insert into public.events (slug, name, venue, starts_at)
  values (
    'caseano-heatwave-x-moxie',
    'Caseano',
    'Muthukadu Boat House, ECR',
    '2026-12-12T19:00:00+05:30'
  )
  on conflict (slug) do update
  set name      = excluded.name,
      venue     = excluded.venue,
      starts_at = excluded.starts_at
  returning id
)
insert into public.ticket_tiers (event_id, code, name, price_male, price_female, status, sort_order)
select ev.id, t.code, t.name, t.price_male, t.price_female, t.status, t.sort_order
from ev,
     (values
       ('early_bird', 'Early Bird', 999, 899, 'open',        1),
       ('phase_1',    'Phase 1',    null, null, 'coming_soon', 2)
     ) as t (code, name, price_male, price_female, status, sort_order);
