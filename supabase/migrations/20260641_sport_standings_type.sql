-- ==============================================================================
-- Sport-specific standings format.
--
-- Adds a nullable `standings_type` column to live_score_sports so each sport
-- can use its own standings table shape and ranking rules instead of one
-- generic Football-style table for every sport:
--   - NULL / 'football': W/D/L, GF/GA/GD, configurable win/draw/loss points
--     (sport_points_config, defaults 3/1/0) - unchanged from before.
--   - 'basketball': no draws. W/L, PF/PA/DIFF, ranked by win% then point
--     differential. No points column.
--   - 'volleyball': W/L plus sets won/lost (team_a_score/team_b_score are
--     entered as sets won, e.g. "3" / "1") and set ratio. Match points use
--     standard FIVB scoring: win by 2+ sets = 3pts, win by 1 set = 2pts,
--     loss by 1 set = 1pt, loss by 2+ sets = 0pts. Ranked by points then set
--     ratio.
--
-- get_team_standings() keeps its existing 3-arg signature (fully backward
-- compatible - any caller passing only p_event_id/p_sport_id is unaffected)
-- and gains three new output columns (standings_type, win_pct, set_ratio).
-- Behavior for sports with standings_type NULL is identical to before.
-- ==============================================================================

ALTER TABLE public.live_score_sports
  ADD COLUMN IF NOT EXISTS standings_type text;

DROP FUNCTION IF EXISTS public.get_team_standings(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_team_standings(p_event_id uuid, p_sport_id uuid DEFAULT NULL, p_division_id uuid DEFAULT NULL)
RETURNS TABLE (
  team_id uuid,
  team_name text,
  standings_type text,
  played integer,
  won integer,
  drawn integer,
  lost integer,
  goals_for integer,
  goals_against integer,
  goal_diff integer,
  points integer,
  win_pct numeric,
  set_ratio numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH sport AS (
    SELECT COALESCE((SELECT standings_type FROM public.live_score_sports WHERE id = p_sport_id), 'football') AS st
  ),
  finished AS (
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
    SELECT
      team_id, gf, ga,
      CASE
        WHEN gf - ga >= 2 THEN 3
        WHEN gf - ga = 1 THEN 2
        WHEN gf - ga = -1 THEN 1
        ELSE 0
      END AS volleyball_match_pts
    FROM finished
    WHERE gf IS NOT NULL AND ga IS NOT NULL
  ),
  agg AS (
    SELECT
      team_id,
      COUNT(*) AS played,
      COUNT(*) FILTER (WHERE gf > ga) AS won,
      COUNT(*) FILTER (WHERE gf = ga) AS drawn,
      COUNT(*) FILTER (WHERE gf < ga) AS lost,
      COALESCE(SUM(gf), 0) AS goals_for,
      COALESCE(SUM(ga), 0) AS goals_against,
      COALESCE(SUM(volleyball_match_pts), 0) AS volleyball_points
    FROM valid
    GROUP BY team_id
  ),
  cfg AS (
    SELECT points_win, points_draw, points_loss
    FROM public.sport_points_config
    WHERE event_id = p_event_id AND sport_id = p_sport_id
  )
  SELECT
    t.id,
    t.name,
    s.st,
    COALESCE(a.played, 0)::int AS played,
    COALESCE(a.won, 0)::int AS won,
    COALESCE(a.drawn, 0)::int AS drawn,
    COALESCE(a.lost, 0)::int AS lost,
    COALESCE(a.goals_for, 0)::int AS goals_for,
    COALESCE(a.goals_against, 0)::int AS goals_against,
    (COALESCE(a.goals_for, 0) - COALESCE(a.goals_against, 0))::int AS goal_diff,
    (CASE s.st
      WHEN 'volleyball' THEN COALESCE(a.volleyball_points, 0)
      WHEN 'basketball' THEN COALESCE(a.won, 0)
      ELSE (COALESCE(a.won, 0) * COALESCE((SELECT points_win FROM cfg), 3)
        + COALESCE(a.drawn, 0) * COALESCE((SELECT points_draw FROM cfg), 1)
        + COALESCE(a.lost, 0) * COALESCE((SELECT points_loss FROM cfg), 0))
    END)::int AS points,
    (CASE WHEN COALESCE(a.played, 0) = 0 THEN 0
      ELSE ROUND(COALESCE(a.won, 0)::numeric / a.played, 3)
    END) AS win_pct,
    ROUND(COALESCE(a.goals_for, 0)::numeric / GREATEST(COALESCE(a.goals_against, 0), 1), 3) AS set_ratio
  FROM public.teams t
  CROSS JOIN sport s
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
    AND (p_division_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.team_sports ts
        WHERE ts.team_id = t.id
          AND ts.division_id = p_division_id
      )
    )
  ORDER BY
    CASE s.st WHEN 'basketball' THEN win_pct ELSE points::numeric END DESC,
    CASE s.st WHEN 'volleyball' THEN set_ratio ELSE goal_diff::numeric END DESC,
    goals_for DESC,
    t.name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_standings(uuid, uuid, uuid) TO anon, authenticated;
