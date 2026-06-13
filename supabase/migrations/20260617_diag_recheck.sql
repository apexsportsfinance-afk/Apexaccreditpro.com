-- Temporary diagnostic RPC (dropped by the follow-up migration).
CREATE OR REPLACE FUNCTION public.__diag_recheck()
RETURNS TABLE (
    relkind text,
    column_name text,
    is_nullable text,
    column_default text,
    data_type text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT c.relkind::text FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'team_rules_acknowledgements'),
    col.column_name, col.is_nullable, col.column_default, col.data_type
  FROM information_schema.columns col
  WHERE col.table_schema = 'public' AND col.table_name = 'team_rules_acknowledgements'
  ORDER BY col.ordinal_position;
$$;

GRANT EXECUTE ON FUNCTION public.__diag_recheck() TO authenticated, anon;
