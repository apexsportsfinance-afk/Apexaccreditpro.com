-- Replace global_settings JSON blob for invite links with a proper table.
-- Adds atomic validate-and-increment RPC to close the race condition on
-- single-use / max-use links under concurrent registrations.

CREATE TABLE IF NOT EXISTS invite_links (
  id               TEXT PRIMARY KEY,
  token            TEXT NOT NULL,
  event_id         UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  label            TEXT NOT NULL DEFAULT 'Invite Link',
  mode             TEXT NOT NULL DEFAULT 'multi' CHECK (mode IN ('single','multi')),
  max_uses         INTEGER,
  use_count        INTEGER NOT NULL DEFAULT 0,
  expires_at       TIMESTAMPTZ,
  role             TEXT,
  club             JSONB,
  require_payment  BOOLEAN NOT NULL DEFAULT false,
  payment_amount   NUMERIC(10,2),
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS invite_links_token_event_idx
  ON invite_links(token, event_id);

ALTER TABLE invite_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "il_select_anon"  ON invite_links FOR SELECT TO anon        USING (true);
CREATE POLICY "il_select_auth"  ON invite_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "il_write_auth"   ON invite_links FOR ALL    TO authenticated USING (true) WITH CHECK (true);

-- Atomic validate + increment (free-registration submit path).
-- Acquires a row-level lock so two concurrent submissions cannot both pass
-- the use-count check before either has incremented.
CREATE OR REPLACE FUNCTION redeem_invite_link(p_token TEXT, p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link       invite_links%ROWTYPE;
  v_new_count  INTEGER;
  v_deactivate BOOLEAN;
BEGIN
  SELECT * INTO v_link
  FROM invite_links
  WHERE token = p_token AND event_id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'invalid');
  END IF;

  IF NOT v_link.is_active THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'inactive');
  END IF;

  IF v_link.expires_at IS NOT NULL AND now() > v_link.expires_at THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired');
  END IF;

  IF v_link.max_uses IS NOT NULL AND v_link.use_count >= v_link.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'limit_reached');
  END IF;

  v_new_count  := v_link.use_count + 1;
  v_deactivate := v_link.mode = 'single'
               OR (v_link.max_uses IS NOT NULL AND v_new_count >= v_link.max_uses);

  UPDATE invite_links
  SET use_count = v_new_count,
      is_active = CASE WHEN v_deactivate THEN false ELSE is_active END
  WHERE id = v_link.id;

  RETURN jsonb_build_object(
    'valid', true,
    'link', jsonb_build_object(
      'id',             v_link.id,
      'token',          v_link.token,
      'label',          v_link.label,
      'mode',           v_link.mode,
      'maxUses',        v_link.max_uses,
      'useCount',       v_new_count,
      'expiresAt',      v_link.expires_at,
      'role',           v_link.role,
      'club',           v_link.club,
      'requirePayment', v_link.require_payment,
      'paymentAmount',  v_link.payment_amount,
      'isActive',       CASE WHEN v_deactivate THEN false ELSE v_link.is_active END,
      'eventId',        p_event_id
    )
  );
END;
$$;

-- Increment-only RPC (Stripe webhook path — payment already confirmed, no need to re-validate).
CREATE OR REPLACE FUNCTION increment_invite_link(p_link_id TEXT, p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link      invite_links%ROWTYPE;
  v_new_count INTEGER;
BEGIN
  SELECT * INTO v_link
  FROM invite_links
  WHERE id = p_link_id AND event_id = p_event_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  v_new_count := v_link.use_count + 1;

  UPDATE invite_links
  SET use_count = v_new_count,
      is_active = CASE
        WHEN v_link.mode = 'single'
          OR (v_link.max_uses IS NOT NULL AND v_new_count >= v_link.max_uses)
        THEN false ELSE is_active END
  WHERE id = v_link.id;
END;
$$;

GRANT EXECUTE ON FUNCTION redeem_invite_link(TEXT, UUID)    TO anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_invite_link(TEXT, UUID) TO anon, authenticated;

-- Migrate existing data from global_settings JSON blobs.
DO $$
DECLARE
  r          RECORD;
  links_json JSONB;
  link       JSONB;
  ev_text    TEXT;
  ev_uuid    UUID;
BEGIN
  FOR r IN
    SELECT key, value FROM global_settings WHERE key LIKE 'event_%_invite_links'
  LOOP
    ev_text := substring(r.key FROM 'event_(.+)_invite_links');
    BEGIN
      ev_uuid := ev_text::UUID;
    EXCEPTION WHEN others THEN CONTINUE;
    END;

    BEGIN
      links_json := r.value::text::jsonb;
    EXCEPTION WHEN others THEN CONTINUE;
    END;

    IF jsonb_typeof(links_json) <> 'array' THEN CONTINUE; END IF;

    FOR link IN SELECT jsonb_array_elements(links_json) LOOP
      INSERT INTO invite_links (
        id, token, event_id, label, mode,
        max_uses, use_count, expires_at, role, club,
        require_payment, payment_amount, is_active, created_at
      ) VALUES (
        link->>'id',
        link->>'token',
        ev_uuid,
        COALESCE(NULLIF(link->>'label', 'null'), 'Invite Link'),
        COALESCE(NULLIF(link->>'mode', 'null'), 'multi'),
        CASE WHEN link->>'maxUses' IN ('null','') OR link->'maxUses' IS NULL THEN NULL
             ELSE (link->>'maxUses')::INTEGER END,
        COALESCE(CASE WHEN link->>'useCount' IN ('null','') THEN NULL
                      ELSE (link->>'useCount')::INTEGER END, 0),
        CASE WHEN link->>'expiresAt' IN ('null','') OR link->'expiresAt' IS NULL THEN NULL
             ELSE (link->>'expiresAt')::TIMESTAMPTZ END,
        NULLIF(NULLIF(link->>'role', 'null'), ''),
        CASE WHEN link->'club' IS NULL OR link->>'club' = 'null' THEN NULL ELSE link->'club' END,
        COALESCE(CASE WHEN link->>'requirePayment' IN ('null','') THEN NULL
                      ELSE (link->>'requirePayment')::BOOLEAN END, false),
        CASE WHEN link->>'paymentAmount' IN ('null','') OR link->'paymentAmount' IS NULL THEN NULL
             ELSE (link->>'paymentAmount')::NUMERIC END,
        COALESCE(CASE WHEN link->>'isActive' IN ('null','') THEN NULL
                      ELSE (link->>'isActive')::BOOLEAN END, true),
        COALESCE(CASE WHEN link->>'createdAt' IN ('null','') OR link->'createdAt' IS NULL THEN NULL
                      ELSE (link->>'createdAt')::TIMESTAMPTZ END, now())
      )
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END LOOP;
END;
$$;
