-- ==============================================================================
-- FIX: get_team_standings() was excluding teams from a sport's standings
-- table unless they had an explicit public.team_sports registration for that
-- sport's name. A team that has fixtures/results recorded against it (via
-- live_score_matches.team_a_id/team_b_id) but never registered the sport in
-- team_sports was silently dropped from the league table even though it has
-- played and finished matches.
--
-- Now a team is included in a sport's standings if EITHER:
--   - it has a team_sports row matching the sport name, OR
--   - it appears as team_a_id/team_b_id on any live_score_matches row for
--     that event + sport (i.e. it has at least one scheduled fixture).
-- ==============================================================================

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
    AND (p_sport_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.team_sports ts
        WHERE ts.team_id = t.id
          AND ts.sport_name = (SELECT sport_name FROM public.live_score_sports WHERE id = p_sport_id)
      )
      OR EXISTS (
        SELECT 1 FROM public.live_score_matches m
        WHERE m.event_id = p_event_id
          AND m.sport_id = p_sport_id
          AND (m.team_a_id = t.id OR m.team_b_id = t.id)
      )
    )
  ORDER BY points DESC, goal_diff DESC, goals_for DESC, t.name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_standings(uuid, uuid) TO anon, authenticated;
