-- ===== PHASE 0 — ENUMERATE (READ-ONLY) — run on STAGING bieqfzwljxkmmldmlzyb =====
-- Changes nothing. Tells us exactly which tables to isolate and what already exists.

-- 0a) Every public table: has event_id? has org_id?  (drives the isolation list)
select
  t.table_name,
  bool_or(c.column_name = 'event_id') as has_event_id,
  bool_or(c.column_name = 'org_id')   as has_org_id
from information_schema.tables t
left join information_schema.columns c
  on c.table_schema = t.table_schema and c.table_name = t.table_name
where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
group by t.table_name
order by has_event_id desc, t.table_name;

-- 0b) Which multi-tenant objects already exist on staging?
select
  to_regclass('public.organizations')       is not null as has_organizations,
  to_regclass('public.organization_members') is not null as has_org_members,
  to_regproc('public.is_platform_admin')     is not null as has_is_platform_admin,
  to_regproc('public.current_user_org_ids')  is not null as has_current_user_org_ids,
  to_regproc('public.my_event_ids')          is not null as has_my_event_ids;

-- 0c) Confirm how the Apex master is identified (expects profiles.role)
select column_name from information_schema.columns
where table_schema='public' and table_name='profiles' and column_name='role';

-- 0d) Sanity counts for the backfill
select
  (select count(*) from public.profiles)                      as total_profiles,
  (select count(*) from public.profiles where role='super_admin') as super_admins,
  (select count(*) from public.events)                        as total_events;
