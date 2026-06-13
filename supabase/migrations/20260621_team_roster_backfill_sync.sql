-- ==============================================================================
-- PHASE 4I (BACKFILL): Sync already-approved accreditations into team rosters
--
-- The auto-sync trigger added in 20260620_team_roster_auto_sync.sql only fires
-- on future INSERTs/status transitions to 'approved'. This one-time backfill
-- applies the same club-name <-> team-name matching to accreditations that
-- were approved before that trigger existed. Idempotent (safe to re-run).
-- ==============================================================================

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
