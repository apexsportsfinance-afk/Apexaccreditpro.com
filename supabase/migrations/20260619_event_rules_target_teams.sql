-- ==============================================================================
-- PHASE 4H: RULES & REGULATIONS - TEAM TARGETING
--
-- Adds `target_team_ids` to `event_rules_documents` so an admin can publish a
-- document once and choose which teams in the event should receive it.
-- NULL (or empty array) means "all teams in this event".
-- ==============================================================================

ALTER TABLE public.event_rules_documents ADD COLUMN IF NOT EXISTS target_team_ids UUID[] DEFAULT NULL;
