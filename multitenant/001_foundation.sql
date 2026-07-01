-- =============================================================================
-- MULTI-TENANT PHASE 1 — FOUNDATION (additive, safe, STAGING-FIRST)
-- =============================================================================
-- WHAT THIS DOES
--   Introduces the two new primitives the platform is missing today:
--     1. organizations          — one row per tenant (a federation, club, etc.)
--     2. organization_members   — links a user to an org WITH a per-org role
--   Plus SECURITY DEFINER helper functions used by every future RLS policy.
--
-- SAFETY
--   * Purely ADDITIVE. Creates new objects only. Touches NO existing table,
--     NO existing row, NO existing policy. Fully reversible (see 999_rollback).
--   * DO NOT run this against LIVE (dixelomafeobabahqeqg).
--   * Apply ONLY to STAGING, via the Supabase WEB SQL editor. Never `db push`.
--
-- Run order: 001_foundation.sql  ->  (next) 002_org_id_rollout.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. organizations — the tenant
-- ---------------------------------------------------------------------------
create table if not exists public.organizations (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,          -- subdomain: <slug>.apexsmart.com
  name              text not null,
  status            text not null default 'active' -- active | trial | suspended
                        check (status in ('active','trial','suspended')),

  -- white-label branding (loaded by the app at runtime)
  logo_url          text,
  brand_primary     text,                          -- hex, e.g. '#0B5FFF'
  brand_secondary   text,

  -- domain mapping
  custom_domain     text unique,                   -- e.g. 'events.clientfc.com' (nullable)

  -- commercial / feature control
  plan              text not null default 'standard'
                        check (plan in ('basic','standard','premium','enterprise')),
  features          jsonb not null default '{}'::jsonb,  -- per-org feature flags

  created_at        timestamptz not null default now()
);

comment on table public.organizations is
  'One row per tenant. Apex itself becomes the first organization at go-live.';

-- ---------------------------------------------------------------------------
-- 2. organization_members — user <-> org, with a per-org role
-- ---------------------------------------------------------------------------
create table if not exists public.organization_members (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  user_id     uuid not null references auth.users(id)          on delete cascade,
  role        text not null
                  check (role in (
                    'org_admin',              -- full control of THIS org
                    'event_manager',
                    'registration_officer',
                    'accreditation_officer',
                    'media',
                    'scanner',
                    'finance',
                    'viewer'
                  )),
  created_at  timestamptz not null default now(),
  unique (org_id, user_id)                     -- a user has ONE role per org
);

create index if not exists idx_org_members_user on public.organization_members(user_id);
create index if not exists idx_org_members_org  on public.organization_members(org_id);

-- ---------------------------------------------------------------------------
-- 3. Helper functions (SECURITY DEFINER) — the single source of truth for
--    every future tenant-scoped RLS policy. Mirrors the existing pattern in
--    20260650_role_trust_hardening.sql (current_app_role / is_admin).
-- ---------------------------------------------------------------------------

-- Apex master access (the platform owner, sits ABOVE all orgs).
-- Reuses the already-hardened, server-controlled profiles.role.
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer
set search_path = public as $$
  select coalesce(
    (select role = 'super_admin' from public.profiles where id = auth.uid()),
    false
  );
$$;

-- The set of orgs the current user belongs to.
create or replace function public.current_user_org_ids()
returns setof uuid language sql stable security definer
set search_path = public as $$
  select org_id from public.organization_members where user_id = auth.uid();
$$;

-- Is the current user a member of this org (any role)?
create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from public.organization_members
    where user_id = auth.uid() and org_id = p_org
  );
$$;

-- Is the current user an admin OF this specific org?
create or replace function public.is_org_admin(p_org uuid)
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from public.organization_members
    where user_id = auth.uid() and org_id = p_org and role = 'org_admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. RLS on the two new tables themselves
-- ---------------------------------------------------------------------------
alter table public.organizations        enable row level security;
alter table public.organization_members enable row level security;

-- organizations: Apex sees all; a member sees only their own org(s).
drop policy if exists org_select on public.organizations;
create policy org_select on public.organizations
  for select to authenticated
  using ( public.is_platform_admin() or id in (select public.current_user_org_ids()) );

-- Only Apex can create / modify / delete organizations (provisioning is an
-- Apex master action). Org self-service branding edits come in a later phase.
drop policy if exists org_write on public.organizations;
create policy org_write on public.organizations
  for all to authenticated
  using ( public.is_platform_admin() )
  with check ( public.is_platform_admin() );

-- organization_members: Apex all; org_admin manages their org; a user can
-- always read their OWN membership rows.
drop policy if exists org_members_select on public.organization_members;
create policy org_members_select on public.organization_members
  for select to authenticated
  using (
    public.is_platform_admin()
    or user_id = auth.uid()
    or public.is_org_admin(org_id)
  );

drop policy if exists org_members_write on public.organization_members;
create policy org_members_write on public.organization_members
  for all to authenticated
  using ( public.is_platform_admin() or public.is_org_admin(org_id) )
  with check ( public.is_platform_admin() or public.is_org_admin(org_id) );

-- =============================================================================
-- DONE. Next: 002_org_id_rollout.sql adds org_id to the existing data tables
-- (events, accreditations, teams, ...) once we confirm the exact table list
-- from staging. THEN we prove cross-tenant isolation.
-- =============================================================================
