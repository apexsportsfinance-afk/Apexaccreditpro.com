-- ==============================================================================
-- PHASE 2 follow-up: capture a denormalized team_name on match_events and
-- player_disciplinary_records so the "Team" field is always available for
-- reporting even when a match's team_a/team_b isn't linked to a real
-- public.teams row (i.e. team_a_id/team_b_id is NULL and only a free-text
-- team_a_name/team_b_name was entered).
-- ==============================================================================

ALTER TABLE public.match_events
  ADD COLUMN IF NOT EXISTS team_name text;

ALTER TABLE public.player_disciplinary_records
  ADD COLUMN IF NOT EXISTS team_name text;
