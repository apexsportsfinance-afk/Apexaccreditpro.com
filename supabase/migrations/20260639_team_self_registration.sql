-- ==============================================================================
-- TEAM SELF-REGISTRATION
--
-- Allows a public "team registration" link (one per event) to insert a new
-- row into public.teams without exposing direct table access to anon users.
-- The event is fixed by the link (validated server-side) and the status is
-- always forced to 'pending' — neither is taken from the caller.
--
-- Run this in the Supabase SQL editor (or `supabase db push`) against the
-- project database. It is written to be idempotent (safe to re-run).
-- ==============================================================================

-- Drop any existing CHECK constraint on public.teams.status so the new
-- 'rejected' status value (used by the admin approve/reject UI) isn't
-- blocked by an undocumented constraint. No-op if none exists.
DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.teams'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.teams DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.submit_team_registration(
  p_event_id UUID,
  p_name TEXT,
  p_short_name TEXT DEFAULT NULL,
  p_country TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_contact_name TEXT DEFAULT NULL,
  p_contact_email TEXT DEFAULT NULL,
  p_contact_phone TEXT DEFAULT NULL,
  p_logo_url TEXT DEFAULT NULL
)
RETURNS public.teams
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.teams;
BEGIN
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'TEAM_NAME_REQUIRED';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id) THEN
    RAISE EXCEPTION 'EVENT_NOT_FOUND';
  END IF;

  INSERT INTO public.teams (
    event_id, name, short_name, country, city,
    contact_name, contact_email, contact_phone, logo_url, status
  )
  VALUES (
    p_event_id, trim(p_name), p_short_name, p_country, p_city,
    p_contact_name, p_contact_email, p_contact_phone, p_logo_url, 'pending'
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_team_registration(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO anon, authenticated;
