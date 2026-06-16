-- Fix RLS gaps identified in the health-check audit.
--
-- Group A: 4 tables with RLS completely disabled → enable + add policies.
-- Group B: 1 table with RLS enabled but 0 policies (registration_sessions) → leave as-is,
--           it is intentionally service-role-only (no frontend access).
-- Group C: 4 tables with policies that are too permissive → tighten.

-- Helper expression used throughout (reuse keeps policies readable):
-- is_admin  →  JWT user_metadata.role is one of the four admin roles
-- is_auth   →  any authenticated session (score operators, scan staff, etc.)

-- =============================================================================
-- GROUP A: Tables with RLS OFF
-- =============================================================================

-- ---------------------------------------------------------------------------
-- A1. event_sessions
--     Used by attendanceApi.js for check-in session management (admin / scan
--     operator side only).  No public read needed.
-- ---------------------------------------------------------------------------
ALTER TABLE public.event_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "es_read_auth" ON public.event_sessions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "es_write_admin" ON public.event_sessions
  FOR ALL TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role')
      IN ('super_admin','event_admin','media_admin','admin')
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role')
      IN ('super_admin','event_admin','media_admin','admin')
  );

-- ---------------------------------------------------------------------------
-- A2. medal_results
--     Public VerifyAccreditation page reads it (anon SELECT).
--     MedalRankings admin page writes it (admin ALL).
-- ---------------------------------------------------------------------------
ALTER TABLE public.medal_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mr_read_public" ON public.medal_results
  FOR SELECT USING (true);

CREATE POLICY "mr_write_admin" ON public.medal_results
  FOR ALL TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role')
      IN ('super_admin','event_admin','media_admin','admin')
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role')
      IN ('super_admin','event_admin','media_admin','admin')
  );

-- ---------------------------------------------------------------------------
-- A3. spectator_tickets
--     Gate staff verify tickets by ticket_code (authenticated SELECT).
--     Admin generates tickets from orders (admin ALL).
-- ---------------------------------------------------------------------------
ALTER TABLE public.spectator_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "st_read_auth" ON public.spectator_tickets
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "st_write_admin" ON public.spectator_tickets
  FOR ALL TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role')
      IN ('super_admin','event_admin','media_admin','admin')
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role')
      IN ('super_admin','event_admin','media_admin','admin')
  );

-- ---------------------------------------------------------------------------
-- A4. rls_test_log
--     Debug/diagnostic table not referenced in any frontend code.
--     Admin-only to prevent data leakage.
-- ---------------------------------------------------------------------------
ALTER TABLE public.rls_test_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rtl_admin_only" ON public.rls_test_log
  FOR ALL TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role')
      IN ('super_admin','event_admin','media_admin','admin')
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role')
      IN ('super_admin','event_admin','media_admin','admin')
  );

-- =============================================================================
-- GROUP C: Policies that are too permissive
-- =============================================================================

-- ---------------------------------------------------------------------------
-- C1. export_jobs
--     Old policy: qual = true (anyone, including anon, can do everything).
--     Fix: admin-only.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin Job ReadWrite" ON public.export_jobs;

CREATE POLICY "ej_admin_all" ON public.export_jobs
  FOR ALL TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role')
      IN ('super_admin','event_admin','media_admin','admin')
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role')
      IN ('super_admin','event_admin','media_admin','admin')
  );

-- ---------------------------------------------------------------------------
-- C2. partner_api_keys
--     Old policy: any authenticated user could read/write API keys.
--     Fix: super_admin / event_admin only (API keys are sensitive credentials).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins have full access to api_keys" ON public.partner_api_keys;

CREATE POLICY "pak_admin_all" ON public.partner_api_keys
  FOR ALL TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role')
      IN ('super_admin','event_admin')
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role')
      IN ('super_admin','event_admin')
  );

-- ---------------------------------------------------------------------------
-- C3. partners
--     Old policy: any authenticated user could read/write partner records.
--     Fix: admin roles only.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins have full access to partners" ON public.partners;

CREATE POLICY "par_admin_all" ON public.partners
  FOR ALL TO authenticated
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role')
      IN ('super_admin','event_admin','media_admin','admin')
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role')
      IN ('super_admin','event_admin','media_admin','admin')
  );

-- ---------------------------------------------------------------------------
-- C4. player_disciplinary_records
--     Old policy: any authenticated user could do everything.
--     Fix: consistent with match_events — public read (cards are public
--     sporting data), authenticated write (score operators record cards).
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Auth Access" ON public.player_disciplinary_records;

CREATE POLICY "pdr_read_public" ON public.player_disciplinary_records
  FOR SELECT USING (true);

CREATE POLICY "pdr_write_auth" ON public.player_disciplinary_records
  FOR ALL TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');
