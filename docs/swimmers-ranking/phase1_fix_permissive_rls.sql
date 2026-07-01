-- =====================================================================
-- SWIMMERS RANKING — Phase 1 FIX: add the missing PERMISSIVE base policy
-- =====================================================================
-- WHY: phase1_schema.sql created ONLY a RESTRICTIVE `tenant_isolation`
--   policy on each ranking_ table. In PostgreSQL a RESTRICTIVE policy can
--   only NARROW access — at least one PERMISSIVE policy must GRANT it first.
--   With no permissive policy, every insert/select is denied → HTTP 403.
--   (Same pairing the proven live tables use: multitenant/003_isolation_proof.sql
--    couples `tenant_isolation` RESTRICTIVE with a `base_read` PERMISSIVE policy.)
--
-- WHAT: add a permissive `ranking_base_access` policy (for all / authenticated)
--   to every ranking_ table. The existing RESTRICTIVE tenant_isolation policy
--   still AND-narrows access to the caller's own org, so tenant isolation is
--   fully preserved — this only restores the base grant that lets the
--   restrictive gate apply at all.
--
-- HOW TO RUN: paste into the Supabase WEB SQL editor and Run (NOT db push).
--   Transaction-wrapped + idempotent (safe to re-run).
-- =====================================================================

begin;

do $$
declare t text;
begin
  foreach t in array array[
    'ranking_clubs','ranking_swimmers','ranking_meets','ranking_import_batches',
    'ranking_import_files','ranking_staging_results','ranking_results','ranking_wa_base_times'
  ] loop
    execute format('drop policy if exists ranking_base_access on public.%I;', t);
    execute format($p$
      create policy ranking_base_access on public.%I
        as permissive for all to authenticated
        using (true)
        with check (true);
    $p$, t);
  end loop;
end $$;

commit;

-- Quick check: each table should now report BOTH a permissive base policy and
-- the restrictive tenant_isolation policy (permissive_ok = t, restrictive_ok = t).
select
  c.relname                                                         as table_name,
  bool_or(p.polpermissive)                                          as permissive_ok,
  bool_or(not p.polpermissive)                                      as restrictive_ok
from pg_policy p
join pg_class c on c.oid = p.polrelid
where c.relname like 'ranking_%'
group by c.relname
order by c.relname;
