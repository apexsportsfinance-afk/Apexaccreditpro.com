-- ==============================================================================
-- PHASE 4I: TEAM ROSTER AUTO-SYNC FROM ACCREDITATION APPROVAL
--
-- When an accreditation is approved, automatically create a team_participants
-- row for the matching team (matched by event_id + club name == team name,
-- case-insensitive, whitespace-trimmed). Auto-synced rows are inserted with
-- status='approved' so they appear immediately in the Team Portal roster
-- without going through the manual admin-review queue (the accreditation
-- approval IS the approval). Team managers can then toggle is_active and fill
-- in jersey number / position from the Team Portal.
--
-- Manually-added roster entries (via "Add Participant" in the portal) keep
-- using the existing pending -> approved/rejected admin-review flow.
-- ==============================================================================

ALTER TABLE public.team_participants
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.sync_accreditation_to_team_roster()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id UUID;
  v_roster_role TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM 'approved' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'approved' THEN
    RETURN NEW;
  END IF;

  IF NEW.club IS NULL OR trim(NEW.club) = '' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_team_id
  FROM public.teams
  WHERE event_id = NEW.event_id
    AND lower(trim(name)) = lower(trim(NEW.club))
  LIMIT 1;

  IF v_team_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_roster_role := CASE
    WHEN NEW.role ILIKE '%assistant coach%' THEN 'assistant_coach'
    WHEN NEW.role ILIKE '%coach%' THEN 'head_coach'
    WHEN NEW.role ILIKE '%manager%' THEN 'team_manager'
    WHEN NEW.role ILIKE '%physio%' THEN 'physio'
    WHEN NEW.role ILIKE '%support%' OR NEW.role ILIKE '%staff%' THEN 'support_staff'
    ELSE 'athlete'
  END;

  INSERT INTO public.team_participants (team_id, event_id, accreditation_id, roster_role, status, is_active)
  SELECT v_team_id, NEW.event_id, NEW.id, v_roster_role, 'approved', true
  WHERE NOT EXISTS (
    SELECT 1 FROM public.team_participants
    WHERE team_id = v_team_id AND accreditation_id = NEW.id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_accreditation_to_team_roster ON public.accreditations;

CREATE TRIGGER trg_sync_accreditation_to_team_roster
AFTER INSERT OR UPDATE OF status ON public.accreditations
FOR EACH ROW
EXECUTE FUNCTION public.sync_accreditation_to_team_roster();
