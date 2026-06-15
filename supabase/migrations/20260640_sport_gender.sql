-- ==============================================================================
-- Gender classification for registered/live-score sports.
--
-- Purely additive, nullable `gender` text columns on team_sports (a team's
-- registration for a given sport, e.g. "Basketball") and live_score_sports
-- (the event-level sport entry used for fixtures/standings in Live Scores).
-- NULL = unspecified (existing rows unaffected). Expected values follow the
-- same convention as competition_divisions.gender: 'Men', 'Women', 'Mixed'.
-- ==============================================================================

ALTER TABLE public.team_sports
  ADD COLUMN IF NOT EXISTS gender text;

ALTER TABLE public.live_score_sports
  ADD COLUMN IF NOT EXISTS gender text;
