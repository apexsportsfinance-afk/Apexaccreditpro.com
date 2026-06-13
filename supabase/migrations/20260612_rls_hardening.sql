-- ==============================================================================
-- RLS HARDENING — consolidates and tightens the ad-hoc fixes previously
-- applied by hand via fix_rls.sql, fix_recursion.sql, cleanup_supabase.sql,
-- setup_event_photos.sql and sync_users.sql (now archived under
-- docs/history/2026-06-12-rls-hardening/).
--
-- Run this in the Supabase SQL editor (or `supabase db push`) against the
-- project database. It is written to be idempotent (safe to re-run).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PROFILES — replace "any authenticated user can read every profile"
--    with: a user can read their own profile, and admin-role users can read
--    all profiles (needed for staff-management screens).
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super Admins can manage all profiles" ON public.profiles;

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Non-recursive admin check via JWT metadata (no self-referencing subquery,
-- avoids the infinite-recursion issue fix_recursion.sql worked around).
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super_admin', 'event_admin', 'media_admin', 'admin')
);

CREATE POLICY "Super Admins can manage all profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'super_admin' OR
  (auth.jwt() ->> 'email') = 'superadmin@accreditpro.com'
);

-- ------------------------------------------------------------------------------
-- 2. BOOKING CONFIGS — public read only for ACTIVE configs; writes restricted
--    to admin-role authenticated users.
-- ------------------------------------------------------------------------------
ALTER TABLE public.booking_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Booking Configs" ON public.booking_configs;
DROP POLICY IF EXISTS "Admins Manage Booking Configs" ON public.booking_configs;

CREATE POLICY "Public Read Active Booking Configs"
ON public.booking_configs
FOR SELECT
USING (is_active = true);

CREATE POLICY "Admins Manage Booking Configs"
ON public.booking_configs
FOR ALL
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super_admin', 'event_admin', 'media_admin', 'admin')
);

-- ------------------------------------------------------------------------------
-- 3. BOOKINGS — remove the blanket "anyone can read/write any row" policies.
--    Admin staff (authenticated, admin-role) keep full read for the booking
--    management screen. Public participants no longer touch this table
--    directly; they go through the SECURITY DEFINER RPCs below, which verify
--    the accreditation_id belongs to the given event before acting.
-- ------------------------------------------------------------------------------
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Bookings" ON public.bookings;
DROP POLICY IF EXISTS "Public Manage Personal Bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins Manage Bookings" ON public.bookings;

CREATE POLICY "Admins Read Bookings"
ON public.bookings
FOR SELECT
TO authenticated
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super_admin', 'event_admin', 'media_admin', 'admin')
);

-- RPC: fetch a participant's own booking(s) for an event. SECURITY DEFINER so
-- it can bypass the table RLS above, but only after verifying ownership.
CREATE OR REPLACE FUNCTION public.get_my_booking(p_event_id UUID, p_accreditation_id UUID)
RETURNS SETOF public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.accreditations
    WHERE id = p_accreditation_id AND event_id = p_event_id
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT * FROM public.bookings
  WHERE event_id = p_event_id AND accreditation_id = p_accreditation_id;
END;
$$;

-- RPC: create/update a participant's own booking for a slot.
CREATE OR REPLACE FUNCTION public.upsert_my_booking(
  p_event_id UUID,
  p_accreditation_id UUID,
  p_slot_id TEXT,
  p_group_name TEXT DEFAULT 'General Meeting'
)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.bookings;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.accreditations
    WHERE id = p_accreditation_id AND event_id = p_event_id
  ) THEN
    RAISE EXCEPTION 'ACCREDITATION_NOT_FOUND_FOR_EVENT';
  END IF;

  INSERT INTO public.bookings (event_id, accreditation_id, slot_id, group_name, updated_at)
  VALUES (p_event_id, p_accreditation_id, p_slot_id, p_group_name, now())
  ON CONFLICT (event_id, accreditation_id, group_name)
  DO UPDATE SET slot_id = EXCLUDED.slot_id, updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- RPC: cancel a participant's own booking for a slot.
CREATE OR REPLACE FUNCTION public.delete_my_booking(
  p_event_id UUID,
  p_accreditation_id UUID,
  p_slot_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.accreditations
    WHERE id = p_accreditation_id AND event_id = p_event_id
  ) THEN
    RAISE EXCEPTION 'ACCREDITATION_NOT_FOUND_FOR_EVENT';
  END IF;

  DELETE FROM public.bookings
  WHERE event_id = p_event_id AND accreditation_id = p_accreditation_id AND slot_id = p_slot_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_booking(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_my_booking(UUID, UUID, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_booking(UUID, UUID, TEXT) TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 4. EVENT PHOTOS — consolidated from setup_event_photos.sql (idempotent).
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    album_name TEXT DEFAULT 'General Event Photos',
    title TEXT,
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    size_bytes BIGINT,
    is_public BOOLEAN DEFAULT true,
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_photos_event_id ON public.event_photos(event_id);

ALTER TABLE public.event_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view public event photos" ON public.event_photos;
DROP POLICY IF EXISTS "Admins can manage event photos" ON public.event_photos;

CREATE POLICY "Public can view public event photos"
ON public.event_photos
FOR SELECT
USING (is_public = true);

CREATE POLICY "Admins can manage event photos"
ON public.event_photos
FOR ALL
USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') IN ('super_admin', 'event_admin', 'media_admin', 'admin')
);

-- ------------------------------------------------------------------------------
-- 5. SECURITY DEFINER HARDENING — pin search_path on existing functions.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'viewer')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_ticket_transaction(
  p_ticket_id UUID,
  p_order_id UUID,
  p_today_date TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_scanned_count INT;
  v_current_status TEXT;
  v_valid_date TEXT;
  v_result JSONB;
BEGIN
  SELECT status, valid_date INTO v_current_status, v_valid_date
  FROM spectator_tickets
  WHERE id = p_ticket_id
  FOR UPDATE;

  IF v_current_status = 'scanned' AND v_valid_date = p_today_date THEN
    RAISE EXCEPTION 'ALREADY_SCANNED';
  END IF;

  UPDATE spectator_tickets
  SET status = 'scanned', scanned_at = NOW()
  WHERE id = p_ticket_id;

  SELECT COUNT(id) INTO v_scanned_count
  FROM spectator_tickets
  WHERE order_id = p_order_id AND status = 'scanned';

  UPDATE spectator_orders
  SET scanned_count = v_scanned_count, last_scan_at = NOW()
  WHERE id = p_order_id;

  SELECT row_to_json(so)::jsonb INTO v_result
  FROM spectator_orders so
  WHERE id = p_order_id;

  RETURN v_result;
END;
$$;
