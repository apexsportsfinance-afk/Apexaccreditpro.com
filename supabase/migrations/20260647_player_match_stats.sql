-- ==============================================================================
-- PHASE 5: SPORT-SPECIFIC PLAYER MATCH STATISTICS
--
-- One additive table (player_match_stats) capturing per-player, per-match
-- statistics whose shape varies by sport (goals/cards for football,
-- points/rebounds for basketball, aces/blocks for volleyball, etc.) without
-- needing a different table per sport. The `stats` column is a flat jsonb
-- map of stat_key -> numeric value; which keys apply to a given sport is a
-- frontend concern (src/lib/sportStatFields.js), keyed off the same
-- `live_score_sports.standings_type` already used for standings columns.
--
-- Two read-only RPCs (mirroring the get_team_standings/get_live_scores_matches
-- SECURITY DEFINER pattern) roll these rows up into per-sport season totals
-- for a single player or a single team, by summing each jsonb key across all
-- of their matches. This is what powers the QR profile's accumulated stats
-- and the admin's team-totals view.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.player_match_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.live_score_matches(id) ON DELETE CASCADE,
  sport_id uuid REFERENCES public.live_score_sports(id) ON DELETE SET NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  team_name text,
  player_accreditation_id uuid NOT NULL REFERENCES public.accreditations(id) ON DELETE CASCADE,
  player_name text NOT NULL,
  participated boolean NOT NULL DEFAULT true,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, player_accreditation_id)
);

CREATE INDEX IF NOT EXISTS idx_player_match_stats_match_id ON public.player_match_stats(match_id);
CREATE INDEX IF NOT EXISTS idx_player_match_stats_event_id ON public.player_match_stats(event_id);
CREATE INDEX IF NOT EXISTS idx_player_match_stats_player ON public.player_match_stats(player_accreditation_id);
CREATE INDEX IF NOT EXISTS idx_player_match_stats_team ON public.player_match_stats(team_id);

ALTER TABLE public.player_match_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Access" ON public.player_match_stats
FOR SELECT USING (true);

CREATE POLICY "Auth Write Access" ON public.player_match_stats
FOR ALL USING (auth.role() = 'authenticated');

-- ------------------------------------------------------------------------------
-- get_player_stat_totals: per-sport accumulated totals for one player across
-- every match they have a stats row for. Powers the public QR "Season Stats"
-- card, so it must be callable by anon.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_player_stat_totals(p_accreditation_id uuid)
RETURNS TABLE (
  sport_id uuid,
  sport_name text,
  standings_type text,
  matches_played bigint,
  stats jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH flattened AS (
    SELECT pms.sport_id, e.key, (e.value)::numeric AS value
    FROM public.player_match_stats pms
    CROSS JOIN LATERAL jsonb_each_text(pms.stats) e
    WHERE pms.player_accreditation_id = p_accreditation_id
  ),
  summed AS (
    SELECT sport_id, key, sum(value) AS total FROM flattened GROUP BY sport_id, key
  ),
  agg AS (
    SELECT sport_id, jsonb_object_agg(key, total) AS stats FROM summed GROUP BY sport_id
  ),
  played AS (
    SELECT sport_id, count(*) AS matches_played
    FROM public.player_match_stats
    WHERE player_accreditation_id = p_accreditation_id AND participated
    GROUP BY sport_id
  )
  SELECT p.sport_id, sp.sport_name, sp.standings_type, p.matches_played, coalesce(a.stats, '{}'::jsonb)
  FROM played p
  LEFT JOIN agg a ON a.sport_id = p.sport_id
  LEFT JOIN public.live_score_sports sp ON sp.id = p.sport_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_player_stat_totals(uuid) TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- get_team_stat_totals: per-sport accumulated totals for one team across all
-- matches any of its players have a stats row for. Admin-facing only (still
-- granted to anon for consistency with the rest of this RPC family, since the
-- table itself already has a public read policy).
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_team_stat_totals(p_team_id uuid)
RETURNS TABLE (
  sport_id uuid,
  sport_name text,
  standings_type text,
  matches_played bigint,
  stats jsonb
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH flattened AS (
    SELECT pms.sport_id, pms.match_id, e.key, (e.value)::numeric AS value
    FROM public.player_match_stats pms
    CROSS JOIN LATERAL jsonb_each_text(pms.stats) e
    WHERE pms.team_id = p_team_id
  ),
  summed AS (
    SELECT sport_id, key, sum(value) AS total FROM flattened GROUP BY sport_id, key
  ),
  agg AS (
    SELECT sport_id, jsonb_object_agg(key, total) AS stats FROM summed GROUP BY sport_id
  ),
  played AS (
    SELECT sport_id, count(DISTINCT match_id) AS matches_played
    FROM public.player_match_stats
    WHERE team_id = p_team_id
    GROUP BY sport_id
  )
  SELECT p.sport_id, sp.sport_name, sp.standings_type, p.matches_played, coalesce(a.stats, '{}'::jsonb)
  FROM played p
  LEFT JOIN agg a ON a.sport_id = p.sport_id
  LEFT JOIN public.live_score_sports sp ON sp.id = p.sport_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_stat_totals(uuid) TO anon, authenticated;
