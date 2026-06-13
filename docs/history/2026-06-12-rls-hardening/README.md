# Superseded by `supabase/migrations/20260612_rls_hardening.sql`

The five SQL scripts in this folder (`fix_rls.sql`, `fix_recursion.sql`,
`cleanup_supabase.sql`, `setup_event_photos.sql`, `sync_users.sql`) were
ad-hoc, hand-run fixes applied directly against the Supabase SQL editor over
time. They are kept here for historical reference only — **do not run them
against the database**.

Their relevant logic has been consolidated, reviewed, and tightened in
[`supabase/migrations/20260612_rls_hardening.sql`](../../../supabase/migrations/20260612_rls_hardening.sql):

- `fix_rls.sql` / `fix_recursion.sql` — the `profiles` table policies these
  scripts created (`USING (true)` for all authenticated users, plus a
  recursive super-admin check) are replaced with an own-row policy and a
  non-recursive JWT-metadata admin-role policy.
- `cleanup_supabase.sql` — the orphan-row DELETE and `VACUUM ANALYZE`
  statements are one-time maintenance operations, not schema/policy changes.
  Run them manually again if a similar cleanup is needed; the index creation
  statements (`idx_accreditations_event_id`, `idx_accreditations_status`,
  `idx_athlete_events_event_id`) are unaffected by the new migration.
- `setup_event_photos.sql` — the `event_photos` table and its policies are
  recreated idempotently (`CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF
  EXISTS` + `CREATE POLICY`) inside the new migration.
- `sync_users.sql` — `handle_new_user()` is recreated with
  `SET search_path = public, pg_temp` added for search-path hardening; the
  trigger and one-time backfill it also defined are unaffected and do not
  need to be re-run.

`booking_configs`/`bookings` (from `supabase/migrations/20260520_booking_system.sql`,
not in this folder) also had their `USING (true)` policies replaced — public
participants now go through `SECURITY DEFINER` RPCs
(`get_my_booking`/`upsert_my_booking`/`delete_my_booking`) instead of direct
table access. See the new migration for details.
