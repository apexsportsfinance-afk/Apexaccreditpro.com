-- Replace the N+1 loop in ZonesAPI.updateWithCascade with two bulk UPDATEs.
-- Uses unnest/string_to_array to replace the old zone code token inside every
-- comma-separated zone_code / default_zone_codes value in a single query each.

CREATE OR REPLACE FUNCTION cascade_zone_code_rename(
  p_event_id UUID,
  p_old_code TEXT,
  p_new_code TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Bulk-update accreditations for this event that contain the old code.
  -- Splits on comma, replaces exact-match tokens, rejoins — handles multi-zone values.
  UPDATE accreditations
  SET zone_code = (
    SELECT string_agg(
      CASE WHEN trim(token) = p_old_code THEN p_new_code ELSE trim(token) END,
      ', '
      ORDER BY ord
    )
    FROM unnest(string_to_array(zone_code, ',')) WITH ORDINALITY AS t(token, ord)
  )
  WHERE event_id = p_event_id
    AND zone_code ILIKE '%' || p_old_code || '%';

  -- Bulk-update categories (global, no event filter).
  UPDATE categories
  SET default_zone_codes = (
    SELECT string_agg(
      CASE WHEN trim(token) = p_old_code THEN p_new_code ELSE trim(token) END,
      ', '
      ORDER BY ord
    )
    FROM unnest(string_to_array(default_zone_codes, ',')) WITH ORDINALITY AS t(token, ord)
  )
  WHERE default_zone_codes ILIKE '%' || p_old_code || '%';
END;
$$;

GRANT EXECUTE ON FUNCTION cascade_zone_code_rename(UUID, TEXT, TEXT) TO authenticated;
