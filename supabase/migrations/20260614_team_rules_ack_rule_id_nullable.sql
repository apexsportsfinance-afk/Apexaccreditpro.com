-- ==============================================================================
-- Fix: team_rules_acknowledgements.rule_id is a leftover column from an older
-- "Rules" feature (NOT NULL, unrelated to the Phase 4G event_rules_documents /
-- document_id model). It blocks inserts from the new Rules & Regulations
-- acknowledgement flow with "null value in column rule_id violates not-null
-- constraint". Nothing in the current codebase reads or writes rule_id.
--
-- Idempotent: safe to re-run.
-- ==============================================================================

ALTER TABLE public.team_rules_acknowledgements ALTER COLUMN rule_id DROP NOT NULL;
