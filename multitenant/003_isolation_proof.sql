-- =============================================================================
-- MULTI-TENANT — ISOLATION PROOF (self-contained, SANDBOX ONLY)
-- =============================================================================
-- Paste this whole file into the SANDBOX SQL editor (utqfugxzeqgtveiwevyi) and
-- Run. It builds a miniature of the real system, creates two organisations,
-- and proves each can see ONLY its own data while Apex (master) sees all.
--
-- The isolation logic (my_event_ids, restrictive policies, is_platform_admin)
-- is IDENTICAL to what ships in 001/002. Only the schema is a small stand-in
-- (events + accreditations + scan logs) so the proof is fast and needs no
-- live data. Re-runnable: it drops and recreates everything each time.
--
-- NEVER run on live. This is a throwaway sandbox demonstration.
-- =============================================================================

-- ---- clean slate ----------------------------------------------------------
drop table if exists public.unified_scan_logs cascade;
drop table if exists public.accreditations    cascade;
drop table if exists public.events            cascade;
drop table if exists public.organization_members cascade;
drop table if exists public.organizations     cascade;
drop table if exists public.profiles          cascade;
drop function if exists public.proof()                cascade;
drop function if exists public.my_event_ids()         cascade;
drop function if exists public.is_org_admin(uuid)     cascade;
drop function if exists public.is_org_member(uuid)    cascade;
drop function if exists public.current_user_org_ids() cascade;
drop function if exists public.is_platform_admin()    cascade;

-- ===========================================================================
-- 1. MINIATURE SCHEMA  (stand-in for the real tables)
-- ===========================================================================
create table public.profiles (              -- platform-level user record
  id   uuid primary key,
  role text                                 -- 'super_admin' = Apex master
);

create table public.organizations (         -- the tenant
  id   uuid primary key,
  name text not null
);

create table public.organization_members (  -- user <-> org + per-org role
  org_id  uuid references public.organizations(id),
  user_id uuid,                              -- (real version FKs auth.users)
  role    text,
  primary key (org_id, user_id)
);

create table public.events (                 -- THE ANCHOR: events carry org_id
  id     uuid primary key,
  org_id uuid references public.organizations(id),
  name   text
);

create table public.accreditations (         -- inherits org via its event
  id        uuid primary key,
  event_id  uuid references public.events(id),
  full_name text
);

create table public.unified_scan_logs (      -- inherits org via its event
  id         uuid primary key,
  event_id   uuid references public.events(id),
  scanned_at timestamptz default now()
);

-- ===========================================================================
-- 2. SECURITY HELPERS  (byte-for-byte the same as 001/002)
-- ===========================================================================
create function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'super_admin' from public.profiles where id = auth.uid()), false);
$$;

create function public.current_user_org_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select org_id from public.organization_members where user_id = auth.uid();
$$;

create function public.is_org_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.organization_members
                 where user_id = auth.uid() and org_id = p_org and role = 'org_admin');
$$;

create function public.my_event_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from public.events
  where public.is_platform_admin() or org_id in (select public.current_user_org_ids());
$$;

-- ===========================================================================
-- 3. RLS — restrictive tenant-isolation policies (the real pattern)
-- ===========================================================================
alter table public.events            enable row level security;
alter table public.accreditations    enable row level security;
alter table public.unified_scan_logs enable row level security;

create policy tenant_isolation on public.events
  as restrictive for all to authenticated
  using ( public.is_platform_admin() or org_id in (select public.current_user_org_ids()) );

create policy tenant_isolation on public.accreditations
  as restrictive for all to authenticated
  using ( public.is_platform_admin() or event_id in (select public.my_event_ids()) );

create policy tenant_isolation on public.unified_scan_logs
  as restrictive for all to authenticated
  using ( public.is_platform_admin() or event_id in (select public.my_event_ids()) );

-- a permissive "allow authenticated" base policy so non-restricted reads work
-- (mirrors the existing role policies that already live on the real tables)
create policy base_read on public.events            for select to authenticated using (true);
create policy base_read on public.accreditations    for select to authenticated using (true);
create policy base_read on public.unified_scan_logs for select to authenticated using (true);

grant select on public.events, public.accreditations, public.unified_scan_logs to authenticated;
grant execute on function public.is_platform_admin(), public.current_user_org_ids(),
                          public.is_org_admin(uuid),  public.my_event_ids() to authenticated;

-- ===========================================================================
-- 4. SEED — two orgs, three users, data in each org
-- ===========================================================================
-- users
insert into public.profiles(id, role) values
  ('00000000-0000-0000-0000-0000000000aa','super_admin'),  -- Apex master
  ('00000000-0000-0000-0000-0000000000a1', null),          -- Org A admin
  ('00000000-0000-0000-0000-0000000000b1', null);          -- Org B admin
-- orgs
insert into public.organizations(id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000000','Demo FC'),
  ('bbbbbbbb-0000-0000-0000-000000000000','Demo Federation');
-- memberships
insert into public.organization_members(org_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000a1','org_admin'),
  ('bbbbbbbb-0000-0000-0000-000000000000','00000000-0000-0000-0000-0000000000b1','org_admin');
-- events (anchored to orgs)
insert into public.events(id, org_id, name) values
  ('e1111111-0000-0000-0000-000000000000','aaaaaaaa-0000-0000-0000-000000000000','Demo FC Championship'),
  ('e2222222-0000-0000-0000-000000000000','bbbbbbbb-0000-0000-0000-000000000000','Demo Federation Cup');
-- accreditations (one per event)
insert into public.accreditations(id, event_id, full_name) values
  ('ac111111-0000-0000-0000-000000000000','e1111111-0000-0000-0000-000000000000','FC Player One'),
  ('ac222222-0000-0000-0000-000000000000','e2222222-0000-0000-0000-000000000000','Fed Player One');
-- scan logs (one per event)
insert into public.unified_scan_logs(id, event_id) values
  ('5c111111-0000-0000-0000-000000000000','e1111111-0000-0000-0000-000000000000'),
  ('5c222222-0000-0000-0000-000000000000','e2222222-0000-0000-0000-000000000000');

-- ===========================================================================
-- 5. THE PROOF — what each user can actually see (RLS enforced as 'authenticated')
-- ===========================================================================
create function public.proof()
returns table(perspective text, events_visible text, accreditations int, scan_logs int)
language plpgsql as $$
declare
  perspectives text[][] := array[
    array['Apex master (super_admin)','00000000-0000-0000-0000-0000000000aa'],
    array['Org A admin (Demo FC)',    '00000000-0000-0000-0000-0000000000a1'],
    array['Org B admin (Demo Fed)',   '00000000-0000-0000-0000-0000000000b1']
  ];
  i int;
begin
  for i in 1 .. array_length(perspectives,1) loop
    -- become this user (set the JWT identity, then run as the authenticated role)
    perform set_config('request.jwt.claim.sub', perspectives[i][2], true);
    perform set_config('request.jwt.claims',
              json_build_object('sub', perspectives[i][2], 'role','authenticated')::text, true);
    set local role authenticated;

    perspective := perspectives[i][1];
    select string_agg(name, ' + ' order by name) from public.events            into events_visible;
    select count(*)                               from public.accreditations    into accreditations;
    select count(*)                               from public.unified_scan_logs into scan_logs;
    return next;

    reset role;   -- back to admin to set up the next perspective
  end loop;
end;
$$;

select * from public.proof();
-- =============================================================================
-- EXPECTED RESULT (this is the proof):
--   Apex master       | Demo FC Championship + Demo Federation Cup | 2 | 2
--   Org A admin       | Demo FC Championship                       | 1 | 1
--   Org B admin       | Demo Federation Cup                        | 1 | 1
-- => Each org sees ONLY its own data. Apex sees everything. ISOLATION PROVEN.
-- =============================================================================
