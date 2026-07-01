# Multi-Tenant — Phase 1: Data Isolation Foundation

**Branch:** `feat/multi-tenant` · **Environment:** STAGING ONLY (`bieqfzwljxkmmldmlzyb`)
**Never** apply to live (`dixelomafeobabahqeqg`). Apply via the Supabase **web** SQL editor, not `db push`.

## Goal of this phase
Prove that two organisations on one shared platform genuinely cannot see each
other's data. This is the hardest, highest-risk part — we do it first.

## Steps
1. **001_foundation.sql** ✅ written — adds `organizations` + `organization_members`
   + helper functions (`is_platform_admin`, `is_org_admin`, `current_user_org_ids`).
   Purely additive; nothing existing changes.
2. **Enumerate staging tables** — run the read-only query below to get the exact
   list of tables + which already have `event_id`. This tells us precisely where
   `org_id` must go.
3. **002_org_id_rollout.sql** — add `org_id` to each data table, backfill, and
   rewrite the RLS policies to scope by org.
4. **Isolation proof** — create two fake orgs ("Demo FC", "Demo Federation"),
   one user each, and verify each user sees ONLY their own events/participants/
   documents/scanner logs. Automated test matrix.

## Read-only staging enumeration query (Step 2)
```sql
select
  t.table_name,
  bool_or(c.column_name = 'event_id') as has_event_id,
  bool_or(c.column_name = 'user_id')  as has_user_id
from information_schema.tables t
left join information_schema.columns c
  on c.table_schema = t.table_schema and c.table_name = t.table_name
where t.table_schema = 'public'
  and t.table_type = 'BASE TABLE'
group by t.table_name
order by t.table_name;
```

## Rollback
Run `999_rollback.sql` to remove everything from step 1. Reversible at any time.
