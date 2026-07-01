-- =============================================================================
-- MULTI-TENANT PHASE 1 — ROLLBACK
-- Removes everything 001_foundation.sql created. Safe on staging.
-- =============================================================================
drop policy if exists org_members_write  on public.organization_members;
drop policy if exists org_members_select on public.organization_members;
drop policy if exists org_write          on public.organizations;
drop policy if exists org_select         on public.organizations;

drop function if exists public.is_org_admin(uuid);
drop function if exists public.is_org_member(uuid);
drop function if exists public.current_user_org_ids();
drop function if exists public.is_platform_admin();

drop table if exists public.organization_members;
drop table if exists public.organizations;
