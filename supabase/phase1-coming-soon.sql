-- Puts Phase 1 back to "coming soon" (not on sale). Run in the Supabase SQL editor.
update public.ticket_tiers
set status = 'coming_soon',
    seat_limit = null
where code = 'phase_1';
