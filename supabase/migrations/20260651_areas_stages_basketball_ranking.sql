-- ==============================================================================
-- Areas/Conferences + fixture stage separation + basketball ranking fix.
--
-- 1. competition_areas: a level above competition_divisions ("Group/Pool"),
--    e.g. "Eastern Conference" containing Groups A/B. Optional `cities` list
--    drives location-based team/group auto-assignment in the UI (teams.city
--    already stores e.g. UAE emirates - see src/lib/utils.js UAE_EMIRATES).
-- 2. competition_divisions.area_id: which area a group/division belongs to.
-- 3. live_score_matches.stage: 'league' | 'group' | 'knockout' | 'playoff' |
--    'final'. NULL (all pre-existing rows) is treated as 'league' for
--    standings purposes - fully backward compatible.
-- 4. live_score_matches.division_id: ties a match to a specific group, so
--    "Group A standings" works even before/independent of permanent team
--    roster division assignment.
-- 5. get_team_standings(): gains p_area_id (4th param, defaults NULL - old
--    3-arg callers unaffected), only aggregates league/group-stage matches
--    (knockout/playoff/final results no longer pollute the table), and adds
--    `won` as basketball's second tiebreak (Win% -> Wins -> Point Diff ->
--    Points Scored -> name).
-- 6. get_live_scores_matches(): exposes the new stage/division_id columns.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.competition_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sport_id uuid NOT NULL REFERENCES public.live_score_sports(id) ON DELETE CASCADE,
  name text NOT NULL,
  cities text[] NOT NULL DEFAULT '{}',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competition_areas_sport_id ON public.competition_areas(sport_id);

ALTER TABLE public.competition_areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Access" ON public.competition_areas;
CREATE POLICY "Public Read Access" ON public.competition_areas
FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth Write Access" ON public.competition_areas;
CREATE POLICY "Auth Write Access" ON public.competition_areas
FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE public.competition_divisions
  ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES public.competition_areas(id) ON DELETE SET NULL;

ALTER TABLE public.live_score_matches
  ADD COLUMN IF NOT EXISTS stage text;

ALTER TABLE public.live_score_matches
  ADD COLUMN IF NOT EXISTS division_id uuid REFERENCES public.competition_divisions(id) ON DELETE SET NULL;

-- ------------------------------------------------------------------------------
-- get_team_standings(): add p_area_id, restrict to league/group stage matches,
-- add `won` as basketball's secondary sort key.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_team_standings(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_team_standings(p_event_id uuid, p_sport_id uuid DEFAULT NULL, p_division_id uuid DEFAULT NULL, p_area_id uuid DEFAULT NULL)
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
      AND (m.stage IS NULL OR m.stage IN ('league', 'group'))
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
      AND (m.stage IS NULL OR m.stage IN ('league', 'group'))
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
    AND (p_area_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.team_sports ts
        JOIN public.competition_divisions d ON d.id = ts.division_id
        WHERE ts.team_id = t.id
          AND d.area_id = p_area_id
      )
    )
  ORDER BY
    CASE s.st
      WHEN 'basketball' THEN
        (CASE WHEN COALESCE(a.played, 0) = 0 THEN 0 ELSE ROUND(COALESCE(a.won, 0)::numeric / a.played, 3) END)
      ELSE
        (CASE s.st
          WHEN 'volleyball' THEN COALESCE(a.volleyball_points, 0)
          ELSE (COALESCE(a.won, 0) * COALESCE((SELECT points_win FROM cfg), 3)
            + COALESCE(a.drawn, 0) * COALESCE((SELECT points_draw FROM cfg), 1)
            + COALESCE(a.lost, 0) * COALESCE((SELECT points_loss FROM cfg), 0))
        END)::numeric
    END DESC,
    CASE WHEN s.st = 'basketball' THEN COALESCE(a.won, 0) ELSE 0 END DESC,
    CASE s.st
      WHEN 'volleyball' THEN ROUND(COALESCE(a.goals_for, 0)::numeric / GREATEST(COALESCE(a.goals_against, 0), 1), 3)
      ELSE (COALESCE(a.goals_for, 0) - COALESCE(a.goals_against, 0))::numeric
    END DESC,
    COALESCE(a.goals_for, 0) DESC,
    t.name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_standings(uuid, uuid, uuid, uuid) TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- get_live_scores_matches(): expose stage + division_id.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_live_scores_matches(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_live_scores_matches(p_event_id uuid, p_sport_id uuid DEFAULT NULL)
RETURNS TABLE (
  id public.live_score_matches.id%TYPE,
  event_id public.live_score_matches.event_id%TYPE,
  sport_id public.live_score_matches.sport_id%TYPE,
  match_title public.live_score_matches.match_title%TYPE,
  league_name public.live_score_matches.league_name%TYPE,
  stage public.live_score_matches.stage%TYPE,
  division_id public.live_score_matches.division_id%TYPE,
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
    m.id, m.event_id, m.sport_id, m.match_title, m.league_name, m.stage, m.division_id,
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
