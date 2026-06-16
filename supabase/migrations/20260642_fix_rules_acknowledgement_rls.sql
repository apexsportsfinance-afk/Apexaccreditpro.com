-- ==============================================================================
-- PHASE 4G FIX: RULES ACKNOWLEDGEMENT RLS
--
-- The "Team members manage own acknowledgements" policy from
-- 20260613_event_rules_documents.sql failed with:
--   42501: new row violates row-level security policy for table
--   "team_rules_acknowledgements"
-- because its EXISTS (SELECT 1 FROM team_users ...) subquery is itself
-- subject to team_users' own RLS policies (same recursion class of issue
-- documented in 20260612_rls_hardening.sql for `profiles`).
--
-- Fix: replace the write policy with a SECURITY DEFINER RPC (same pattern as
-- the booking RPCs below "BOOKINGS" in 20260612_rls_hardening.sql) which
-- checks team membership manually, then bypasses RLS for the insert/update.
-- SELECT policy is simplified to a plain `user_id = auth.uid()` check
-- (no recursive subquery needed).
--
-- Idempotent: safe to re-run.
-- ==============================================================================

DROP POLICY IF EXISTS "Team members manage own acknowledgements" ON public.team_rules_acknowledgements;
DROP POLICY IF EXISTS "Users can view own acknowledgements" ON public.team_rules_acknowledgements;

CREATE POLICY "Users can view own acknowledgements"
ON public.team_rules_acknowledgements
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- RPC: acknowledge ("read and accepted") a rules document for the calling
-- user, after verifying they belong to the given team.
CREATE OR REPLACE FUNCTION public.acknowledge_rules_document(
  p_event_id UUID,
  p_team_id UUID,
  p_document_id UUID
)
RETURNS public.team_rules_acknowledgements
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.team_rules_acknowledgements;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.team_users
    WHERE team_id = p_team_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'NOT_A_TEAM_MEMBER';
  END IF;

  INSERT INTO public.team_rules_acknowledgements (event_id, team_id, document_id, user_id, acknowledged_at)
  VALUES (p_event_id, p_team_id, p_document_id, auth.uid(), now())
  ON CONFLICT (team_id, document_id, user_id)
  DO UPDATE SET acknowledged_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.acknowledge_rules_document(UUID, UUID, UUID) TO authenticated;
