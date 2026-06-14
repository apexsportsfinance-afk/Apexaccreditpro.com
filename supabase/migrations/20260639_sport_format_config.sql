-- ==============================================================================
-- PHASE 4: Competition format builder.
--
-- Purely additive, nullable columns on the pre-existing live_score_sports
-- table. `format` records which competition format the admin picked for this
-- sport (e.g. "Round Robin", "Groups + Knockout", "Single Elimination",
-- "Double Elimination", "Conference", "Custom") and `format_config` stores
-- format-specific options (number of groups, conferences, etc.) as JSON.
-- Both default to NULL, so existing sports/rows are unaffected and behave
-- exactly as before (manual fixture entry, i.e. "Custom").
-- ==============================================================================

ALTER TABLE public.live_score_sports
  ADD COLUMN IF NOT EXISTS format text,
  ADD COLUMN IF NOT EXISTS format_config jsonb;
