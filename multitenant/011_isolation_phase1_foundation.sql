-- ===== PHASE 1 — FOUNDATION (additive, idempotent, DORMANT) — run on STAGING =====
-- Adds the tenancy primitives + helper functions. Touches NO existing table,
-- NO existing data, NO existing policy. Safe to re-run. Same safety class as the
-- branding deploy. The behavior change (isolation) comes later in Phases 2-3.

-- 1) organizations (create if missing; harmless if it already exists)
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null,
  status text not null default 'active',
  logo_url text, logo_text text, brand_primary text, brand_dark text,
  tagline text, custom_domain text unique, hide_powered_by boolean default false,
  plan text default 'standard', features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.organizations enable row level security;

-- 2) organization_members: user <-> org + per-org role
create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in
    ('org_admin','event_manager','registration_officer','accreditation_officer','media','scanner','finance','viewer')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index if not exists idx_org_members_user on public.organization_members(user_id);
create index if not exists idx_org_members_org  on public.organization_members(org_id);
alter table public.organization_members enable row level security;

-- 3) Helper functions (SECURITY DEFINER) — single source of truth for isolation
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.current_user_org_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select org_id from public.organization_members where user_id = auth.uid();
$$;

create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.organization_members where user_id=auth.uid() and org_id=p_org);
$$;

create or replace function public.is_org_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.organization_members where user_id=auth.uid() and org_id=p_org and role='org_admin');
$$;

-- 4) RLS on the two NEW tables only (Apex all; member reads own; org_admin manages own)
drop policy if exists org_select on public.organizations;
create policy org_select on public.organizations for select to authenticated
  using ( public.is_platform_admin() or id in (select public.current_user_org_ids()) );
drop policy if exists org_write on public.organizations;
create policy org_write on public.organizations for all to authenticated
  using ( public.is_platform_admin() ) with check ( public.is_platform_admin() );

drop policy if exists org_members_select on public.organization_members;
create policy org_members_select on public.organization_members for select to authenticated
  using ( public.is_platform_admin() or user_id = auth.uid() or public.is_org_admin(org_id) );
drop policy if exists org_members_write on public.organization_members;
create policy org_members_write on public.organization_members for all to authenticated
  using ( public.is_platform_admin() or public.is_org_admin(org_id) )
  with check ( public.is_platform_admin() or public.is_org_admin(org_id) );

-- 5) Verify
select
  to_regclass('public.organizations')        is not null as organizations_ok,
  to_regclass('public.organization_members')  is not null as members_ok,
  to_regproc('public.is_platform_admin')      is not null as is_platform_admin_ok,
  to_regproc('public.current_user_org_ids')   is not null as org_ids_ok,
  (select is_platform_admin from (select public.is_platform_admin() as is_platform_admin) s) as i_am_platform_admin;
