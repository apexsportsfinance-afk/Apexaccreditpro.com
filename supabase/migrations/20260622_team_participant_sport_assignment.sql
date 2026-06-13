-- ==============================================================================
-- PHASE 4 (KICKOFF): SPORT ASSIGNMENT FOR ROSTER PARTICIPANTS
--
-- Adds `sport_name` to team_participants so each roster member can be tied to
-- one of the team's registered sports (team_sports). When auto-syncing from
-- an approved accreditation, if the athlete registered for exactly one sport
-- that the team is also registered for, pre-fill it. Otherwise leave NULL so
-- an admin/manager can pick from the team's registered sports.
-- ==============================================================================

ALTER TABLE public.team_participants
  ADD COLUMN IF NOT EXISTS sport_name TEXT;

CREATE OR REPLACE FUNCTION public.sync_accreditation_to_team_roster()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id UUID;
  v_roster_role TEXT;
  v_sport_name TEXT;
  v_sport_matches TEXT[];
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

  IF NEW.selected_sports IS NOT NULL THEN
    SELECT array_agg(DISTINCT ts.sport_name) INTO v_sport_matches
    FROM public.team_sports ts
    WHERE ts.team_id = v_team_id
      AND ts.sport_name IN (SELECT jsonb_array_elements_text(to_jsonb(NEW.selected_sports)));

    IF array_length(v_sport_matches, 1) = 1 THEN
      v_sport_name := v_sport_matches[1];
    END IF;
  END IF;

  INSERT INTO public.team_participants (team_id, event_id, accreditation_id, roster_role, status, is_active, sport_name)
  SELECT v_team_id, NEW.event_id, NEW.id, v_roster_role, 'approved', true, v_sport_name
  WHERE NOT EXISTS (
    SELECT 1 FROM public.team_participants
    WHERE team_id = v_team_id AND accreditation_id = NEW.id
  );

  RETURN NEW;
END;
$$;

-- Backfill sport_name for existing rows where exactly one of the team's
-- registered sports matches the athlete's selected sports.
WITH candidate AS (
  SELECT
    tp.id AS participant_id,
    ts.sport_name,
    COUNT(*) OVER (PARTITION BY tp.id) AS match_count
  FROM public.team_participants tp
  JOIN public.accreditations a ON a.id = tp.accreditation_id
  JOIN public.team_sports ts ON ts.team_id = tp.team_id
    AND ts.sport_name IN (SELECT jsonb_array_elements_text(to_jsonb(a.selected_sports)))
  WHERE tp.sport_name IS NULL
    AND a.selected_sports IS NOT NULL
)
UPDATE public.team_participants tp
SET sport_name = c.sport_name
FROM candidate c
WHERE tp.id = c.participant_id AND c.match_count = 1;
