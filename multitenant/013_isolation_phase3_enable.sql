-- ===== PHASE 3 — ENABLE ISOLATION (the behavior change) =====
-- Backfill (Phase 2) MUST be done first: all events tagged to Apex org, all
-- users are Apex-org members. With that, this is a no-op for current users
-- (they see everything via Apex membership; super_admin bypasses) and isolates
-- only future client orgs. Ends with an immediate proof. Rollback at the bottom.

-- 1) The set of event ids the current user may reach
create or replace function public.my_event_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select id from public.events
  where public.is_platform_admin() or org_id in (select public.current_user_org_ids());
$$;
grant execute on function public.my_event_ids() to authenticated;

-- 2) Reusable, NULL-AWARE isolation layer for event-scoped child tables.
--    READ: global rows (event_id NULL, e.g. default email templates) + your own.
--    WRITE: your own events only (NULL writes still allowed so current Apex staff
--    workflows that create global config don't break — tighten before onboarding
--    the first real client).
create or replace function public.apply_tenant_isolation(p_table text)
returns void language plpgsql as $$
begin
  execute format('alter table public.%I enable row level security;', p_table);
  execute format('drop policy if exists tenant_isolation on public.%I;', p_table);
  execute format($f$
    create policy tenant_isolation on public.%I
      as restrictive for all to authenticated
      using      ( public.is_platform_admin() or event_id is null or event_id::text in (select e::text from public.my_event_ids() e) )
      with check ( public.is_platform_admin() or event_id is null or event_id::text in (select e::text from public.my_event_ids() e) );
  $f$, p_table);
end;
$$;

-- 3) events itself — isolate on org_id directly
alter table public.events enable row level security;
drop policy if exists tenant_isolation on public.events;
create policy tenant_isolation on public.events
  as restrictive for all to authenticated
  using      ( public.is_platform_admin() or org_id in (select public.current_user_org_ids()) )
  with check ( public.is_platform_admin() or org_id in (select public.current_user_org_ids()) );

-- 4) Auto-stamp org_id on new events from the creator's org (so they see it)
create or replace function public.set_event_org_id()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.org_id is null then
    new.org_id := (select org_id from public.organization_members
                   where user_id = auth.uid() limit 1);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_set_event_org_id on public.events;
create trigger trg_set_event_org_id before insert on public.events
  for each row execute function public.set_event_org_id();

-- 5) Apply isolation to EVERY event-scoped table (self-discovering)
do $$
declare r record;
begin
  for r in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'event_id'
      and t.table_type = 'BASE TABLE'
  loop
    perform public.apply_tenant_isolation(r.table_name);
  end loop;
end $$;

-- 6) IMMEDIATE PROOF — both must still see all 10 events (access preserved)
create or replace function public.isolation_check()
returns table(perspective text, events_visible int) language plpgsql as $$
declare
  ids    uuid[] := array[
    (select id from public.profiles where role='super_admin' limit 1),
    (select id from public.profiles where role is distinct from 'super_admin' limit 1)
  ];
  labels text[] := array['super_admin','normal staff'];
  i int;
begin
  for i in 1..2 loop
    perform set_config('request.jwt.claim.sub', ids[i]::text, true);
    perform set_config('request.jwt.claims',
              json_build_object('sub', ids[i]::text, 'role','authenticated')::text, true);
    set local role authenticated;
    perspective := labels[i] || ' (' || ids[i] || ')';
    select count(*) from public.events into events_visible;
    return next;
    reset role;
  end loop;
end;
$$;
select * from public.isolation_check();
-- EXPECT: super_admin -> 10, normal staff -> 10.  If normal staff shows 0, RUN ROLLBACK.

-- =============================================================================
-- ROLLBACK (instant — pasted separately, only if the proof or app misbehaves):
--   do $$ declare r record; begin
--     for r in select c.table_name from information_schema.columns c
--       join information_schema.tables t on t.table_schema=c.table_schema and t.table_name=c.table_name
--       where c.table_schema='public' and c.column_name='event_id' and t.table_type='BASE TABLE'
--     loop execute format('drop policy if exists tenant_isolation on public.%I;', r.table_name); end loop;
--     drop policy if exists tenant_isolation on public.events;
--   end $$;
-- =============================================================================
