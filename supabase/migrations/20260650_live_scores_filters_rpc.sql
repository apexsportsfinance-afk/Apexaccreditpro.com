-- ==============================================================================
-- Public QR live-scores widget currently fetches every sport's matches for an
-- event in one call, then filters client-side. For events with many sports/
-- leagues this means downloading the entire fixture list up front.
--
-- Extends get_live_scores_matches() with optional status / league_name /
-- match_date filters so the widget can push filtering down to Postgres and
-- only ever fetch the subset the visitor actually asked to see.
--
-- Backward compatible: all new params default to NULL (= no filter), so
-- existing callers (PortalScheduleTab, admin LiveScoresTab via direct table
-- queries) that only pass p_event_id / p_sport_id are unaffected.
-- ==============================================================================

DROP FUNCTION IF EXISTS public.get_live_scores_matches(uuid, uuid);

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
    m.team_a_id, m.team_b_id,
    m.team_a_name, m.team_b_name, m.team_a_score, m.team_b_score,
    m.match_date, m.match_time, m.venue, m.status, m.notes,
    m.created_at, m.updated_at,
    ta.logo_url, ta.country, tb.logo_url, tb.country
  FROM public.live_score_matches m
  LEFT JOIN public.teams ta ON ta.id = m.team_a_id
  LEFT JOIN public.teams tb ON tb.id = m.team_b_id
  WHERE m.event_id = p_event_id
    AND (p_sport_id IS NULL OR m.sport_id = p_sport_id)
    AND (p_status IS NULL OR m.status = p_status)
    AND (p_league_name IS NULL OR m.league_name = p_league_name)
    AND (p_match_date IS NULL OR m.match_date = p_match_date)
  ORDER BY m.match_date ASC, m.match_time ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_live_scores_matches(uuid, uuid, public.live_score_matches.status%TYPE, public.live_score_matches.league_name%TYPE, public.live_score_matches.match_date%TYPE) TO anon, authenticated;

-- ==============================================================================
-- Lightweight distinct-value lookup so the public widget can populate its
-- League and Date filter dropdowns for a chosen sport WITHOUT downloading the
-- full match rows (team joins, scores, notes, etc).
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_live_scores_filter_options(p_event_id uuid, p_sport_id uuid DEFAULT NULL)
RETURNS TABLE (
  league_names text[],
  match_dates date[]
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    array_remove(array_agg(DISTINCT m.league_name), NULL),
    array_remove(array_agg(DISTINCT m.match_date), NULL)
  FROM public.live_score_matches m
  WHERE m.event_id = p_event_id
    AND (p_sport_id IS NULL OR m.sport_id = p_sport_id);
$$;

GRANT EXECUTE ON FUNCTION public.get_live_scores_filter_options(uuid, uuid) TO anon, authenticated;
