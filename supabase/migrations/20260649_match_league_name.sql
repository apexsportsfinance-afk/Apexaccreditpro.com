-- ==============================================================================
-- Add league_name to live_score_matches so matches within the same sport can
-- be grouped into named leagues (e.g. "Group A", "Premier League").
-- Nullable - all existing rows remain unaffected.
-- Also updates the get_live_scores_matches RPC to expose the column.
-- ==============================================================================

ALTER TABLE public.live_score_matches
  ADD COLUMN IF NOT EXISTS league_name text;

-- Update the public RPC to include league_name in its output
-- Must DROP first because adding a column changes the return type signature
DROP FUNCTION IF EXISTS public.get_live_scores_matches(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_live_scores_matches(p_event_id uuid, p_sport_id uuid DEFAULT NULL)
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
  ORDER BY m.match_date ASC, m.match_time ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_live_scores_matches(uuid, uuid) TO anon, authenticated;
