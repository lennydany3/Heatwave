-- Turns the existing seeded event row into Caseano (Heatwave x Moxie Club).
-- Run once in the Supabase SQL editor. The slug is deliberately left alone: it's
-- an internal id the app looks the event up by, and existing registrations and
-- tickets stay attached to the row.
--
-- Ticket tiers already match (Early Bird 999 male / 899 female, Phase 1 coming
-- soon), so only the event itself changes.

update public.events
set name      = 'Caseano',
    venue     = 'Muthukadu Boat House, ECR',
    starts_at = '2026-12-12T19:00:00+05:30'
where slug = 'product-builders-summit-2027';
