-- ==============================================================================
-- PARTNER API KEY HASHING (HIGH)
--
-- Problem: partner_api_keys.api_key was stored in plaintext and verified with a
-- direct equality match (server.js: .eq('api_key', apiKey)). A DB read or
-- backup leak exposed live partner credentials, and verification required the
-- API server to pull the credential table.
--
-- Fix:
--   1. Add api_key_hash (SHA-256 hex) and backfill it from existing keys.
--   2. Provide a SECURITY DEFINER RPC `verify_partner_api_key(hash)` so the API
--      server verifies by hash WITHOUT broad read access to the table and
--      WITHOUT ever handling the plaintext credential at rest.
--
-- The plaintext api_key column is intentionally left in place (no data deleted)
-- so the admin UI can still display a freshly generated key once; operators may
-- later null it out after partners have re-keyed. Verification no longer depends
-- on it.
--
-- Idempotent: safe to re-run.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.partner_api_keys
  ADD COLUMN IF NOT EXISTS api_key_hash text;

-- Backfill hashes for any existing plaintext keys.
UPDATE public.partner_api_keys
SET api_key_hash = encode(digest(api_key, 'sha256'), 'hex')
WHERE api_key_hash IS NULL AND api_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_api_keys_hash
  ON public.partner_api_keys(api_key_hash);

-- Verification RPC: takes a SHA-256 hash, returns the partner + allocated
-- fields for an ACTIVE key, and stamps last_used_at. SECURITY DEFINER so the
-- API server (anon role) can call it while the table itself stays admin-only.
CREATE OR REPLACE FUNCTION public.verify_partner_api_key(p_key_hash text)
RETURNS TABLE (key_id uuid, allowed_fields jsonb, partner_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id    uuid;
  v_fields jsonb;
  v_pname text;
BEGIN
  IF p_key_hash IS NULL OR length(p_key_hash) <> 64 THEN
    RETURN;
  END IF;

  SELECT k.id, to_jsonb(k.allowed_fields), p.name
    INTO v_id, v_fields, v_pname
  FROM public.partner_api_keys k
  JOIN public.partners p ON p.id = k.partner_id
  WHERE k.api_key_hash = p_key_hash
    AND k.status = 'active'
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.partner_api_keys SET last_used_at = now() WHERE id = v_id;

  RETURN QUERY SELECT v_id, v_fields, v_pname;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_partner_api_key(text) TO anon, authenticated;
