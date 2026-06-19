-- ==============================================================================
-- ROLE-TRUST HARDENING (CRITICAL)
--
-- Problem: every RLS policy decided "is this user an admin?" by reading
--   (auth.jwt() -> 'user_metadata' ->> 'role')
-- In Supabase, `user_metadata` (raw_user_meta_data) is SELF-WRITABLE by any
-- authenticated user via supabase.auth.updateUser({ data: { role: 'super_admin' }}).
-- A normal user could therefore mint an admin JWT and bypass every policy
-- below -> full privilege escalation.
--
-- Fix: decide admin status from the server-controlled `public.profiles.role`
-- column (which has NO self-update policy) via SECURITY DEFINER helper
-- functions. SECURITY DEFINER runs as the function owner and bypasses RLS on
-- the inner read, so there is no recursion when the helper is used inside the
-- profiles policies themselves.
--
-- Idempotent: safe to re-run. Run in the Supabase SQL editor or `supabase db push`.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. HELPER FUNCTIONS — single source of truth for role checks.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Any of the four admin roles (broad management surface).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT public.current_app_role() IN ('super_admin','event_admin','media_admin','admin');
$$;

-- Sensitive surface (API keys etc.) — super_admin / event_admin only.
CREATE OR REPLACE FUNCTION public.is_super_or_event_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT public.current_app_role() IN ('super_admin','event_admin');
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT public.current_app_role() = 'super_admin';
$$;

GRANT EXECUTE ON FUNCTION public.current_app_role()        TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin()                TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_or_event_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin()          TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 1. SIGNUP TRIGGER — never let a client-supplied signup mint a privileged role.
--    Admin-created users get their role assigned out-of-band by the
--    `manage-users` Edge Function (service role); ordinary signups default to
--    'viewer'. Existing profiles.role is preserved on conflict.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_requested_role text := NEW.raw_user_meta_data->>'role';
  v_safe_role text;
BEGIN
  -- Only honour a privileged role if it was set in app_metadata (service-role
  -- controlled). Anything coming from user-supplied metadata collapses to viewer.
  v_safe_role := COALESCE(
    NEW.raw_app_meta_data->>'role',
    CASE WHEN v_requested_role IN ('super_admin','event_admin','media_admin','admin')
         THEN NULL                      -- ignore self-claimed admin on signup
         ELSE v_requested_role END,
    'viewer'
  );

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    v_safe_role
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;   -- role intentionally NOT overwritten on conflict
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 1b. BACKFILL — make sure every existing user has a profiles.role so that
--     switching the authority from JWT metadata to profiles does not lock
--     anyone out. Only fills NULLs (never overwrites an existing value), so a
--     pre-existing role is always preserved.
--
--     OPERATOR NOTE: after running, verify the super admin still resolves:
--       SELECT id, email, role FROM public.profiles WHERE role = 'super_admin';
--     If a known admin shows the wrong role, correct it directly in profiles.
-- ------------------------------------------------------------------------------
UPDATE public.profiles p
SET role = COALESCE(
  (SELECT u.raw_user_meta_data->>'role' FROM auth.users u WHERE u.id = p.id),
  'viewer'
)
WHERE p.role IS NULL;

-- ------------------------------------------------------------------------------
-- 2. PROFILES — block self-escalation explicitly and base admin reads on profiles.
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Super Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Super Admins can manage all profiles"
ON public.profiles FOR ALL TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- Allow a user to edit their OWN profile, but never their own role.
DROP POLICY IF EXISTS "Users can update own profile (not role)" ON public.profiles;
CREATE POLICY "Users can update own profile (not role)"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
);

-- ------------------------------------------------------------------------------
-- 3. RECREATE EVERY ADMIN POLICY THAT PREVIOUSLY TRUSTED user_metadata.
--    (Names match the originals so this is a clean in-place swap.)
-- ------------------------------------------------------------------------------

-- 20260612_rls_hardening.sql --------------------------------------------------
DROP POLICY IF EXISTS "Admins Manage Booking Configs" ON public.booking_configs;
CREATE POLICY "Admins Manage Booking Configs"
ON public.booking_configs FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins Read Bookings" ON public.bookings;
CREATE POLICY "Admins Read Bookings"
ON public.bookings FOR SELECT TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage event photos" ON public.event_photos;
CREATE POLICY "Admins can manage event photos"
ON public.event_photos FOR ALL
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 20260613_event_rules_documents.sql ------------------------------------------
DROP POLICY IF EXISTS "Admins manage rules documents" ON public.event_rules_documents;
CREATE POLICY "Admins manage rules documents"
ON public.event_rules_documents FOR ALL TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins view all acknowledgements" ON public.team_rules_acknowledgements;
CREATE POLICY "Admins view all acknowledgements"
ON public.team_rules_acknowledgements FOR SELECT TO authenticated
USING (public.is_admin());

-- 20260647_rls_gap_fix.sql ----------------------------------------------------
DROP POLICY IF EXISTS "es_write_admin" ON public.event_sessions;
CREATE POLICY "es_write_admin" ON public.event_sessions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "mr_write_admin" ON public.medal_results;
CREATE POLICY "mr_write_admin" ON public.medal_results
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "st_write_admin" ON public.spectator_tickets;
CREATE POLICY "st_write_admin" ON public.spectator_tickets
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "rtl_admin_only" ON public.rls_test_log;
CREATE POLICY "rtl_admin_only" ON public.rls_test_log
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "ej_admin_all" ON public.export_jobs;
CREATE POLICY "ej_admin_all" ON public.export_jobs
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- API keys are sensitive credentials -> super_admin / event_admin only.
DROP POLICY IF EXISTS "pak_admin_all" ON public.partner_api_keys;
CREATE POLICY "pak_admin_all" ON public.partner_api_keys
  FOR ALL TO authenticated
  USING (public.is_super_or_event_admin()) WITH CHECK (public.is_super_or_event_admin());

DROP POLICY IF EXISTS "par_admin_all" ON public.partners;
CREATE POLICY "par_admin_all" ON public.partners
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 20260648_event_document_requirements.sql ------------------------------------
DROP POLICY IF EXISTS "Admins manage doc requirements" ON public.event_document_requirements;
CREATE POLICY "Admins manage doc requirements"
  ON public.event_document_requirements FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());
