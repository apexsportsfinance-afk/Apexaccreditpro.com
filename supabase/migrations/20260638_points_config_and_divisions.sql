-- ==============================================================================
-- PHASE 3: Configurable sport-based points system + division/gender-separated
-- standings.
--
-- Two new, purely additive tables (sport_points_config, competition_divisions)
-- plus one new nullable column on the pre-existing team_sports table
-- (division_id). get_team_standings() gains a new optional p_division_id
-- param (default NULL = current behavior, fully backward compatible) and now
-- reads per-sport win/draw/loss points from sport_points_config, falling back
-- to the previous hardcoded 3/1/0 when no config row exists.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- sport_points_config: optional per-event-per-sport points overrides.
-- Mirrors live_score_sports RLS (public read, any authenticated user can manage
-- since it's edited from the same Live Scores admin screen).
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sport_points_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sport_id uuid NOT NULL REFERENCES public.live_score_sports(id) ON DELETE CASCADE,
  points_win integer NOT NULL DEFAULT 3,
  points_draw integer NOT NULL DEFAULT 1,
  points_loss integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, sport_id)
);

ALTER TABLE public.sport_points_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Access" ON public.sport_points_config
FOR SELECT USING (true);

CREATE POLICY "Auth Write Access" ON public.sport_points_config
FOR ALL USING (auth.role() = 'authenticated');

-- ------------------------------------------------------------------------------
-- competition_divisions: named groupings (e.g. "Men's Division A", "U-18
-- Girls") within a sport, used to split standings/fixtures into separate
-- tables. Mirrors live_score_sports RLS.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.competition_divisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sport_id uuid NOT NULL REFERENCES public.live_score_sports(id) ON DELETE CASCADE,
  name text NOT NULL,
  gender text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competition_divisions_sport_id ON public.competition_divisions(sport_id);

ALTER TABLE public.competition_divisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Access" ON public.competition_divisions
FOR SELECT USING (true);

CREATE POLICY "Auth Write Access" ON public.competition_divisions
FOR ALL USING (auth.role() = 'authenticated');

-- ------------------------------------------------------------------------------
-- team_sports.division_id: which division a team competes in for that sport.
-- Nullable - existing rows are unaffected (NULL = ungrouped / no division).
-- ------------------------------------------------------------------------------
ALTER TABLE public.team_sports
  ADD COLUMN IF NOT EXISTS division_id uuid REFERENCES public.competition_divisions(id) ON DELETE SET NULL;

-- ------------------------------------------------------------------------------
-- get_team_standings(): add optional division filter + configurable points.
-- The previous 2-arg signature is dropped and replaced with a 3-arg version
-- where the new param defaults to NULL, so all existing callers (which only
-- ever pass p_event_id/p_sport_id) continue to work unchanged.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_team_standings(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_team_standings(p_event_id uuid, p_sport_id uuid DEFAULT NULL, p_division_id uuid DEFAULT NULL)
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
  ),
  cfg AS (
    SELECT points_win, points_draw, points_loss
    FROM public.sport_points_config
    WHERE event_id = p_event_id AND sport_id = p_sport_id
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
    (COALESCE(a.won, 0) * COALESCE((SELECT points_win FROM cfg), 3)
      + COALESCE(a.drawn, 0) * COALESCE((SELECT points_draw FROM cfg), 1)
      + COALESCE(a.lost, 0) * COALESCE((SELECT points_loss FROM cfg), 0))::int AS points
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
    AND (p_division_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.team_sports ts
        WHERE ts.team_id = t.id
          AND ts.division_id = p_division_id
      )
    )
  ORDER BY points DESC, goal_diff DESC, goals_for DESC, t.name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_standings(uuid, uuid, uuid) TO anon, authenticated;
