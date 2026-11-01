-- Role-based access for the admin portal: Admin, Manager, Staff.
-- Run in the Supabase SQL editor, in TWO steps (step 1 on its own first).

-- ── Step 1: run this alone ────────────────────────────────────────────────
-- Adds the two new roles to the existing profiles.role enum.
alter type public.user_role add value if not exists 'manager';
alter type public.user_role add value if not exists 'staff';

-- ── Step 2: run after step 1 has finished ─────────────────────────────────
-- Per-user page visibility + masking rules. Shape:
--   { "<page>": ["<masked item>", ...], ... }
-- A page key present = visible in the sidebar; the array lists what is hidden
-- inside it. Admins ignore this column (they always see everything).
alter table public.profiles
  add column if not exists permissions jsonb;

-- Managers and staff are NOT 'admin', so existing row-level-security rules keep
-- them out of the database from the browser. All their data comes through the
-- app's API routes, which apply the masking on the server.
