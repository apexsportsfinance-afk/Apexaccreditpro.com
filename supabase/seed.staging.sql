-- ============================================================
-- ApexAccreditPro — STAGING fake-data seed (TEMPLATE)
-- ============================================================
-- Run this ONLY against the apex-staging Supabase project, and ONLY
-- AFTER the schema exists (see supabase/STAGING_SCHEMA.md).
--
--   psql "<STAGING_DB_URL>" -f supabase/seed.staging.sql
--
-- RULES:
--   * FAKE data only. Never insert real athlete names, photos, IDs, PII.
--   * This is a TEMPLATE. The base tables were created in the live
--     dashboard, so confirm the column names below against your dumped
--     schema.live.sql before running — adjust any that differ. It is wrapped
--     in a transaction so a mismatch rolls back cleanly instead of leaving
--     half-seeded rows.
-- ============================================================

begin;

-- A couple of obviously-fake events ----------------------------------------
insert into public.events (name, timezone)
values
  ('STAGING — Test Cup 2026',  'Asia/Dubai'),
  ('STAGING — Demo League',    'Asia/Dubai')
on conflict do nothing;

-- A couple of fake teams ----------------------------------------------------
insert into public.teams (name)
values
  ('STAGING FC'),
  ('Demo Athletics Club')
on conflict do nothing;

-- NOTE: accreditations / zones / spectator_orders etc. intentionally left
-- out of this minimal template because their NOT-NULL columns and foreign
-- keys vary. Add them here once you've confirmed the exact columns from
-- schema.live.sql — keep every value fake and tagged "STAGING".

commit;

-- After seeding, do the DevTools pre-flight isolation check before testing:
-- every Supabase request must hit <STAGING_REF>.supabase.co, never the live ref.
