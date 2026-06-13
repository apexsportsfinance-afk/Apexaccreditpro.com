-- ==============================================================================
-- Fix: team_rules_acknowledgements.acknowledged_by is another leftover NOT NULL
-- column from an older "Rules" feature, unrelated to the Phase 4G
-- event_rules_documents / document_id + user_id model. It blocks inserts from
-- the new Rules & Regulations acknowledgement flow with "null value in column
-- acknowledged_by violates not-null constraint". Nothing in the current
-- codebase reads or writes acknowledged_by.
--
-- Also drops the temporary diagnostic RPC added in 20260615.
--
-- Idempotent: safe to re-run.
-- ==============================================================================

ALTER TABLE public.team_rules_acknowledgements ALTER COLUMN acknowledged_by DROP NOT NULL;

DROP FUNCTION IF EXISTS public.__diag_table_columns(text);
