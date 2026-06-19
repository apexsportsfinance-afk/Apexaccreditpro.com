-- ============================================================
-- ApexAccreditPro — STAGING fake-data seed (SQL fallback)
-- ============================================================
-- CANONICAL SEEDER IS scripts/seed-staging.mjs — prefer it. The script also
-- creates the test ADMIN LOGIN (auth.users), which plain SQL cannot do reliably
-- across GoTrue versions, and seeds zones/categories/accreditations too:
--
--   $env:STAGING_SERVICE_ROLE_KEY = "<staging service_role JWT>"
--   node scripts/seed-staging.mjs
--
-- This .sql is a minimal FALLBACK for the public tables only (no login), for when
-- you only have psql. Run ONLY against the apex-staging project, after the schema
-- exists (see supabase/STAGING_SCHEMA.md):
--
--   psql "<STAGING_DB_URL>" -f supabase/seed.staging.sql
--
-- RULES: FAKE data only — never real athlete names, photos, IDs, or PII.
-- Columns below are verified against schema.live.sql (events.slug and
-- teams.event_id are NOT NULL, so both must be supplied). Wrapped in a
-- transaction so a mismatch rolls back cleanly.
-- ============================================================

begin;

-- Obviously-fake events (slug is NOT NULL + UNIQUE) -------------------------
insert into public.events (slug, name, start_date, end_date, location, timezone)
values
  ('staging-test-cup-2026', 'STAGING — Test Cup 2026', '2026-07-01', '2026-07-05', 'Staging Arena, Dubai', 'Asia/Dubai'),
  ('staging-demo-league',   'STAGING — Demo League',   '2026-08-10', '2026-08-12', 'Demo Stadium, Dubai',  'Asia/Dubai')
on conflict (slug) do nothing;

-- Fake teams (event_id is NOT NULL) ----------------------------------------
insert into public.teams (event_id, name, short_name, country, city, status)
select e.id, v.name, v.short_name, 'AE', v.city, v.status
from (values
  ('staging-test-cup-2026', 'STAGING FC',          'SFC', 'Dubai',     'approved'),
  ('staging-test-cup-2026', 'Demo Athletics Club', 'DAC', 'Abu Dhabi', 'pending'),
  ('staging-demo-league',   'Sample United',       'SU',  'Sharjah',   'approved')
) as v(slug, name, short_name, city, status)
join public.events e on e.slug = v.slug
on conflict do nothing;

-- Fake zones (code + name NOT NULL) ----------------------------------------
insert into public.zones (event_id, code, name, color, allowed_roles)
select e.id, v.code, v.name, v.color, v.allowed_roles
from (values
  ('FOP', 'Field of Play', '#16a34a', array['Athlete','Official']),
  ('MED', 'Media Tribune', '#2563eb', array['Media']),
  ('VIP', 'VIP Lounge',    '#9333ea', array[]::text[]),
  ('OPS', 'Operations',    '#ea580c', array['Official','Staff'])
) as v(code, name, color, allowed_roles)
cross join public.events e
where e.slug in ('staging-test-cup-2026', 'staging-demo-league')
on conflict do nothing;

-- NOTE: accreditations need a created_by profile id (i.e. an auth user), so the
-- script seeds them. Add fake ones here only if you already have a profile id.

commit;

-- Pre-flight: in DevTools -> Network, confirm every Supabase request targets
-- bieqfzwljxkmmldmlzyb.supabase.co and never the live ref dixelomafeobabahqeqg.
