-- =============================================================================
-- MULTI-TENANT PHASE 1 — STEP 2: ANCHOR TENANCY ON EVENTS + ISOLATION
-- =============================================================================
-- STRATEGY
--   * Add org_id to the ROOT table only: events.
--   * Every event-scoped child table inherits its org through its event_id —
--     no new column, no 44-table backfill.
--   * Isolation is enforced with RESTRICTIVE policies layered on top of the
--     existing ~40 hardened policies (we do NOT rewrite them). Restrictive
--     policies are AND-ed, so they can only narrow access, never widen it.
--   * Apex master (is_platform_admin) bypasses isolation and sees all orgs.
--
-- SAFETY
--   * Run on SANDBOX/STAGING ONLY. Never live (dixelomafeobabahqeqg).
--   * Requires 001_foundation.sql first.
--   * This file proves isolation on the CORE tables. The SAME two-line pattern
--     (see apply_tenant_isolation) then extends to every other event-scoped
--     table in step 003.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Anchor: events.org_id
-- ---------------------------------------------------------------------------
alter table public.events
  add column if not exists org_id uuid references public.organizations(id);

create index if not exists idx_events_org on public.events(org_id);

-- The set of event ids the current user is allowed to reach.
-- Apex master -> all events. Org user -> only their org(s)' events.
create or replace function public.my_event_ids()
returns setof uuid language sql stable security definer
set search_path = public as $$
  select id from public.events
  where public.is_platform_admin()
     or org_id in (select public.current_user_org_ids());
$$;

-- ---------------------------------------------------------------------------
-- 2. Reusable isolation layer applied per child table.
--    Adds ONE restrictive policy: a row is visible/writable only if its
--    event_id belongs to an event the user may reach. Existing role policies
--    still apply on top (AND-ed) and are untouched.
-- ---------------------------------------------------------------------------
create or replace function public.apply_tenant_isolation(p_table text)
returns void language plpgsql as $$
begin
  execute format('alter table public.%I enable row level security;', p_table);
  execute format('drop policy if exists tenant_isolation on public.%I;', p_table);
  execute format($f$
    create policy tenant_isolation on public.%I
      as restrictive
      for all
      to authenticated
      using ( public.is_platform_admin() or event_id in (select public.my_event_ids()) )
      with check ( public.is_platform_admin() or event_id in (select public.my_event_ids()) );
  $f$, p_table);
end;
$$;

-- events itself: restrictive isolation directly on org_id.
alter table public.events enable row level security;
drop policy if exists tenant_isolation on public.events;
create policy tenant_isolation on public.events
  as restrictive
  for all
  to authenticated
  using ( public.is_platform_admin() or org_id in (select public.current_user_org_ids()) )
  with check ( public.is_platform_admin() or org_id in (select public.current_user_org_ids()) );

-- ---------------------------------------------------------------------------
-- 3. Apply isolation to the CORE proof set (event-scoped tables).
--    Step 003 will loop the SAME call over the remaining ~38 tables.
-- ---------------------------------------------------------------------------
select public.apply_tenant_isolation('accreditations');
select public.apply_tenant_isolation('teams');
select public.apply_tenant_isolation('team_participants');
select public.apply_tenant_isolation('unified_scan_logs');
select public.apply_tenant_isolation('broadcasts_v2');
select public.apply_tenant_isolation('spectator_orders');
select public.apply_tenant_isolation('event_photos');
select public.apply_tenant_isolation('invite_links');

-- =============================================================================
-- DONE. Next: 003_isolation_proof.sql creates two fake orgs + users and
-- verifies Org A cannot see Org B's events/participants/scan logs.
-- =============================================================================
