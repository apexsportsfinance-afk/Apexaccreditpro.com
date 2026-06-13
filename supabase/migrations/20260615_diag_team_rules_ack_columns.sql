-- Temporary diagnostic RPC to inspect column constraints on
-- team_rules_acknowledgements (dropped by the follow-up migration).
CREATE OR REPLACE FUNCTION public.__diag_table_columns(tbl text)
RETURNS TABLE (column_name text, is_nullable text, column_default text, data_type text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.column_name, c.is_nullable, c.column_default, c.data_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = tbl
  ORDER BY c.ordinal_position;
$$;

GRANT EXECUTE ON FUNCTION public.__diag_table_columns(text) TO authenticated, anon;
