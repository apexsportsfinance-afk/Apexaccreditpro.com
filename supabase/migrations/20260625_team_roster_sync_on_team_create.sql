-- ==============================================================================
-- PHASE 4I (CONTINUED): SYNC ROSTER WHEN A TEAM IS CREATED/RENAMED AFTER
-- THE FACT
--
-- The auto-sync trigger added in 20260620_team_roster_auto_sync.sql only
-- fires when an accreditation is approved. If the team didn't exist yet at
-- that point (the matching team is created later), the matching
-- team_participants row never gets created and the new team's roster stays
-- empty even though approved members already exist with a matching club
-- name.
--
-- This migration:
--   1. Re-runs the one-time backfill (idempotent) so any teams created since
--      20260621_team_roster_backfill_sync.sql immediately pick up matching
--      approved accreditations.
--   2. Adds triggers on public.teams so that creating a new team (or
--      renaming one) auto-syncs matching approved accreditations into
--      team_participants going forward.
-- ==============================================================================

-- 1. Catch-up backfill for any team created after the last backfill run.
INSERT INTO public.team_participants (team_id, event_id, accreditation_id, roster_role, status, is_active)
SELECT
  t.id,
  a.event_id,
  a.id,
  CASE
    WHEN a.role ILIKE '%assistant coach%' THEN 'assistant_coach'
    WHEN a.role ILIKE '%coach%' THEN 'head_coach'
    WHEN a.role ILIKE '%manager%' THEN 'team_manager'
    WHEN a.role ILIKE '%physio%' THEN 'physio'
    WHEN a.role ILIKE '%support%' OR a.role ILIKE '%staff%' THEN 'support_staff'
    ELSE 'athlete'
  END,
  'approved',
  true
FROM public.accreditations a
JOIN public.teams t
  ON t.event_id = a.event_id
  AND lower(trim(t.name)) = lower(trim(a.club))
WHERE a.status = 'approved'
  AND a.club IS NOT NULL AND trim(a.club) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.team_participants tp
    WHERE tp.team_id = t.id AND tp.accreditation_id = a.id
  );

-- 2. Sync matching approved accreditations whenever a team is created or renamed.
CREATE OR REPLACE FUNCTION public.sync_team_roster_on_team_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.team_participants (team_id, event_id, accreditation_id, roster_role, status, is_active)
  SELECT
    NEW.id,
    a.event_id,
    a.id,
    CASE
      WHEN a.role ILIKE '%assistant coach%' THEN 'assistant_coach'
      WHEN a.role ILIKE '%coach%' THEN 'head_coach'
      WHEN a.role ILIKE '%manager%' THEN 'team_manager'
      WHEN a.role ILIKE '%physio%' THEN 'physio'
      WHEN a.role ILIKE '%support%' OR a.role ILIKE '%staff%' THEN 'support_staff'
      ELSE 'athlete'
    END,
    'approved',
    true
  FROM public.accreditations a
  WHERE a.event_id = NEW.event_id
    AND a.status = 'approved'
    AND a.club IS NOT NULL AND trim(a.club) <> ''
    AND lower(trim(a.club)) = lower(trim(NEW.name))
    AND NOT EXISTS (
      SELECT 1 FROM public.team_participants tp
      WHERE tp.team_id = NEW.id AND tp.accreditation_id = a.id
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_team_roster_on_insert ON public.teams;
CREATE TRIGGER trg_sync_team_roster_on_insert
AFTER INSERT ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.sync_team_roster_on_team_change();

DROP TRIGGER IF EXISTS trg_sync_team_roster_on_rename ON public.teams;
CREATE TRIGGER trg_sync_team_roster_on_rename
AFTER UPDATE OF name ON public.teams
FOR EACH ROW
WHEN (OLD.name IS DISTINCT FROM NEW.name)
EXECUTE FUNCTION public.sync_team_roster_on_team_change();
