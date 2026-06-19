-- ==============================================================================
-- Fixes an overload bug introduced by 20260651: that migration recreated
-- get_live_scores_matches() with only (uuid, uuid), instead of replacing the
-- real 5-param version from 20260650 (p_event_id, p_sport_id, p_status,
-- p_league_name, p_match_date - used by LiveScoresAPI.getMatchesWithTeams,
-- i.e. the public portal/QR live-scores widget). That left two overloaded
-- functions with overlapping optional params, which makes calls ambiguous.
--
-- This migration drops both overloads and rebuilds a single 5-param version,
-- now also returning stage/division_id/division_name/area_id/area_name so
-- the public schedule views can show "Eastern Conference - Group A" etc.
-- without needing the full divisions/areas lists client-side.
-- ==============================================================================

DROP FUNCTION IF EXISTS public.get_live_scores_matches(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_live_scores_matches(uuid, uuid, text, text, date);

CREATE FUNCTION public.get_live_scores_matches(
  p_event_id uuid,
  p_sport_id uuid DEFAULT NULL,
  p_status public.live_score_matches.status%TYPE DEFAULT NULL,
  p_league_name public.live_score_matches.league_name%TYPE DEFAULT NULL,
  p_match_date public.live_score_matches.match_date%TYPE DEFAULT NULL
)
RETURNS TABLE (
  id public.live_score_matches.id%TYPE,
  event_id public.live_score_matches.event_id%TYPE,
  sport_id public.live_score_matches.sport_id%TYPE,
  match_title public.live_score_matches.match_title%TYPE,
  league_name public.live_score_matches.league_name%TYPE,
  stage public.live_score_matches.stage%TYPE,
  division_id public.live_score_matches.division_id%TYPE,
  division_name public.competition_divisions.name%TYPE,
  area_id public.competition_areas.id%TYPE,
  area_name public.competition_areas.name%TYPE,
  team_a_id public.live_score_matches.team_a_id%TYPE,
  team_b_id public.live_score_matches.team_b_id%TYPE,
  team_a_name public.live_score_matches.team_a_name%TYPE,
  team_b_name public.live_score_matches.team_b_name%TYPE,
  team_a_score public.live_score_matches.team_a_score%TYPE,
  team_b_score public.live_score_matches.team_b_score%TYPE,
  match_date public.live_score_matches.match_date%TYPE,
  match_time public.live_score_matches.match_time%TYPE,
  venue public.live_score_matches.venue%TYPE,
  status public.live_score_matches.status%TYPE,
  notes public.live_score_matches.notes%TYPE,
  created_at public.live_score_matches.created_at%TYPE,
  updated_at public.live_score_matches.updated_at%TYPE,
  team_a_logo_url public.teams.logo_url%TYPE,
  team_a_country public.teams.country%TYPE,
  team_b_logo_url public.teams.logo_url%TYPE,
  team_b_country public.teams.country%TYPE
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    m.id, m.event_id, m.sport_id, m.match_title, m.league_name,
    m.stage, m.division_id, d.name, d.area_id, ar.name,
    m.team_a_id, m.team_b_id,
    m.team_a_name, m.team_b_name, m.team_a_score, m.team_b_score,
    m.match_date, m.match_time, m.venue, m.status, m.notes,
    m.created_at, m.updated_at,
    ta.logo_url, ta.country, tb.logo_url, tb.country
  FROM public.live_score_matches m
  LEFT JOIN public.teams ta ON ta.id = m.team_a_id
  LEFT JOIN public.teams tb ON tb.id = m.team_b_id
  LEFT JOIN public.competition_divisions d ON d.id = m.division_id
  LEFT JOIN public.competition_areas ar ON ar.id = d.area_id
  WHERE m.event_id = p_event_id
    AND (p_sport_id IS NULL OR m.sport_id = p_sport_id)
    AND (p_status IS NULL OR m.status = p_status)
    AND (p_league_name IS NULL OR m.league_name = p_league_name)
    AND (p_match_date IS NULL OR m.match_date = p_match_date)
  ORDER BY m.match_date ASC, m.match_time ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_live_scores_matches(uuid, uuid, public.live_score_matches.status%TYPE, public.live_score_matches.league_name%TYPE, public.live_score_matches.match_date%TYPE) TO anon, authenticated;
