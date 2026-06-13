-- ==============================================================================
-- PHASE 5: SCHEDULE / FIXTURES / STANDINGS
--
-- Links live_score_matches fixtures to real Team Portal teams (team_a_id /
-- team_b_id) so the Team Portal can show a team's own schedule and a
-- win/draw/loss points league table per sport, built on top of the existing
-- live_score_sports / live_score_matches tables used by the public live
-- scores widget.
-- ==============================================================================

ALTER TABLE public.live_score_matches
  ADD COLUMN IF NOT EXISTS team_a_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS team_b_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_live_score_matches_team_a ON public.live_score_matches(team_a_id);
CREATE INDEX IF NOT EXISTS idx_live_score_matches_team_b ON public.live_score_matches(team_b_id);

-- Computes a win/draw/loss points league table for an event (optionally
-- scoped to a single live_score_sports.id) from Finished matches that have
-- both team_a_id and team_b_id linked to real teams. Points: Win=3, Draw=1,
-- Loss=0, ranked by points then goal difference.
CREATE OR REPLACE FUNCTION public.get_team_standings(p_event_id uuid, p_sport_id uuid DEFAULT NULL)
RETURNS TABLE (
  team_id uuid,
  team_name text,
  played integer,
  won integer,
  drawn integer,
  lost integer,
  goals_for integer,
  goals_against integer,
  goal_diff integer,
  points integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH finished AS (
    SELECT
      m.team_a_id AS team_id,
      NULLIF(regexp_replace(m.team_a_score, '[^0-9]', '', 'g'), '')::int AS gf,
      NULLIF(regexp_replace(m.team_b_score, '[^0-9]', '', 'g'), '')::int AS ga
    FROM public.live_score_matches m
    WHERE m.event_id = p_event_id
      AND m.status = 'Finished'
      AND m.team_a_id IS NOT NULL AND m.team_b_id IS NOT NULL
      AND (p_sport_id IS NULL OR m.sport_id = p_sport_id)
    UNION ALL
    SELECT
      m.team_b_id AS team_id,
      NULLIF(regexp_replace(m.team_b_score, '[^0-9]', '', 'g'), '')::int AS gf,
      NULLIF(regexp_replace(m.team_a_score, '[^0-9]', '', 'g'), '')::int AS ga
    FROM public.live_score_matches m
    WHERE m.event_id = p_event_id
      AND m.status = 'Finished'
      AND m.team_a_id IS NOT NULL AND m.team_b_id IS NOT NULL
      AND (p_sport_id IS NULL OR m.sport_id = p_sport_id)
  ),
  valid AS (
    SELECT * FROM finished WHERE gf IS NOT NULL AND ga IS NOT NULL
  ),
  agg AS (
    SELECT
      team_id,
      COUNT(*) AS played,
      COUNT(*) FILTER (WHERE gf > ga) AS won,
      COUNT(*) FILTER (WHERE gf = ga) AS drawn,
      COUNT(*) FILTER (WHERE gf < ga) AS lost,
      COALESCE(SUM(gf), 0) AS goals_for,
      COALESCE(SUM(ga), 0) AS goals_against
    FROM valid
    GROUP BY team_id
  )
  SELECT
    t.id,
    t.name,
    COALESCE(a.played, 0)::int,
    COALESCE(a.won, 0)::int,
    COALESCE(a.drawn, 0)::int,
    COALESCE(a.lost, 0)::int,
    COALESCE(a.goals_for, 0)::int,
    COALESCE(a.goals_against, 0)::int,
    (COALESCE(a.goals_for, 0) - COALESCE(a.goals_against, 0))::int AS goal_diff,
    (COALESCE(a.won, 0) * 3 + COALESCE(a.drawn, 0))::int AS points
  FROM public.teams t
  LEFT JOIN agg a ON a.team_id = t.id
  WHERE t.event_id = p_event_id
    AND (p_sport_id IS NULL OR EXISTS (
      SELECT 1 FROM public.team_sports ts
      WHERE ts.team_id = t.id
        AND ts.sport_name = (SELECT sport_name FROM public.live_score_sports WHERE id = p_sport_id)
    ))
  ORDER BY points DESC, goal_diff DESC, goals_for DESC, t.name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_standings(uuid, uuid) TO anon, authenticated;

-- Drop the temporary diagnostic helper from the previous migration.
DROP FUNCTION IF EXISTS public.diag_live_scores_schema();
