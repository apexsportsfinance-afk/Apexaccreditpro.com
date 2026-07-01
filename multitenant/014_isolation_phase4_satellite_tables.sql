-- ===== PHASE 4 — ISOLATE THE 6 SATELLITE TABLES (no event_id column) =====
-- These 6 tables were SKIPPED by 013's self-discovering loop (no event_id col).
-- Isolated here via parent FK / custom scope. RESTRICTIVE, super_admin bypass,
-- to authenticated, reversible. v2 (2026-06-29): NULL escape hatch REMOVED — a
-- live spot-check confirmed 0 NULLs in every scope column, and for these tables
-- a NULL scope would be orphan data, not a legitimately-global row.
--
--   spectator_tickets -> order_id -> spectator_orders.event_id
--   lane_matrix       -> meet_id (text) == events.id
--   medal_results     -> competition (text) == events.name   (fragile name-match)
--   profiles          -> self (id=auth.uid()) + same-org members
--   audit_logs        -> READ platform-admin only; WRITE self-audit allowed
--   export_jobs       -> self (created_by) + same-org members
--
-- ⚠️ ANON CAVEAT: lane_matrix + medal_results have public/anon SELECT policies;
--    this restrictive layer is `to authenticated`, so logged-out reads are NOT
--    fenced. Decide separately whether those should be public in white-label.
-- ============================================================================


-- 1) spectator_tickets ── isolate strictly through the parent order's event ----
alter table public.spectator_tickets enable row level security;
drop policy if exists tenant_isolation on public.spectator_tickets;
create policy tenant_isolation on public.spectator_tickets
  as restrictive for all to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1 from public.spectator_orders o
      where o.id = spectator_tickets.order_id
        and o.event_id::text in (select e::text from public.my_event_ids() e)
    )
  )
  with check (
    public.is_platform_admin()
    or exists (
      select 1 from public.spectator_orders o
      where o.id = spectator_tickets.order_id
        and o.event_id::text in (select e::text from public.my_event_ids() e)
    )
  );


-- 2) lane_matrix ── meet_id (text) IS the event id -----------------------------
alter table public.lane_matrix enable row level security;
drop policy if exists tenant_isolation on public.lane_matrix;
create policy tenant_isolation on public.lane_matrix
  as restrictive for all to authenticated
  using (
    public.is_platform_admin()
    or meet_id::text in (select e::text from public.my_event_ids() e)
  )
  with check (
    public.is_platform_admin()
    or meet_id::text in (select e::text from public.my_event_ids() e)
  );


-- 3) medal_results ── scope by competition name == events.name -----------------
--    Only link the app has (VerifyAccreditation ilike "competition" = events.name).
--    ⚠️ Fragile: two orgs with a same-named event would cross-see. Long-term fix
--    = add event_id (uuid) FK to medal_results and switch to the event_id scope.
alter table public.medal_results enable row level security;
drop policy if exists tenant_isolation on public.medal_results;
create policy tenant_isolation on public.medal_results
  as restrictive for all to authenticated
  using (
    public.is_platform_admin()
    or exists (
      select 1 from public.events ev
      where ev.id::text in (select e::text from public.my_event_ids() e)
        and lower(trim(ev.name)) = lower(trim(medal_results.competition))
    )
  )
  with check (
    public.is_platform_admin()
    or exists (
      select 1 from public.events ev
      where ev.id::text in (select e::text from public.my_event_ids() e)
        and lower(trim(ev.name)) = lower(trim(medal_results.competition))
    )
  );


-- 4) profiles ── self + same-org members ---------------------------------------
--    AND-restricts the existing "Admins can view all profiles" permissive policy
--    so a client org-admin can't read every tenant's users. id=auth.uid() keeps
--    self-profile readable so login/bootstrap never breaks.
--    ⚠️ MUST use a SECURITY DEFINER helper for the same-org set: a plain subquery
--    on organization_members is itself RLS-gated (org_members_select), so a non-
--    org-admin viewer would collapse it to just themselves and see ONLY their own
--    profile (broke apex admins). my_org_user_ids() bypasses that. Net effect: a
--    NO-OP for Apex (all share one org → allows every apex profile for everyone),
--    while a client is fenced to its own org's users.
create or replace function public.my_org_user_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select om.user_id from public.organization_members om
  where om.org_id in (select org_id from public.organization_members where user_id = auth.uid());
$$;
grant execute on function public.my_org_user_ids() to authenticated;

alter table public.profiles enable row level security;
drop policy if exists tenant_isolation on public.profiles;
create policy tenant_isolation on public.profiles
  as restrictive for all to authenticated
  using (
    public.is_platform_admin()
    or id = auth.uid()
    or id in (select public.my_org_user_ids())
  )
  with check (
    public.is_platform_admin()
    or id = auth.uid()
    or id in (select public.my_org_user_ids())
  );


-- 5) audit_logs ── READ platform-admin only; WRITE your own audit rows ----------
--    A client federation must not read the platform audit trail. We DON'T block
--    inserts (every user action writes an audit row as itself) — with_check lets
--    a user write rows where user_id is their own uid. anon inserts are untouched
--    (this policy is `to authenticated`).
--    ⚠️ Removes audit VIEWING from any non-super-admin who had it. If normal apex
--    admins use the audit screen, switch `using` to an org-scoped form instead.
alter table public.audit_logs enable row level security;
drop policy if exists tenant_isolation on public.audit_logs;
create policy tenant_isolation on public.audit_logs
  as restrictive for all to authenticated
  using ( public.is_platform_admin() )
  with check ( public.is_platform_admin() or user_id = auth.uid()::text );


-- 6) export_jobs ── self + same-org members ------------------------------------
alter table public.export_jobs enable row level security;
drop policy if exists tenant_isolation on public.export_jobs;
create policy tenant_isolation on public.export_jobs
  as restrictive for all to authenticated
  using (
    public.is_platform_admin()
    or created_by = auth.uid()
    or created_by in (
      select user_id from public.organization_members
      where org_id in (select public.current_user_org_ids())
    )
  )
  with check (
    public.is_platform_admin()
    or created_by = auth.uid()
    or created_by in (
      select user_id from public.organization_members
      where org_id in (select public.current_user_org_ids())
    )
  );


-- ----------------------------------------------------------------------------
-- VERIFY (run immediately after — must list tenant_isolation on all 6 + the
-- spectator_orders one from 013 = 7 rows). If any are missing, that statement
-- failed and the batch rolled back; re-run that section alone.
--   select tablename, policyname, permissive
--   from pg_policies
--   where schemaname='public' and policyname='tenant_isolation'
--     and tablename in ('spectator_tickets','lane_matrix','medal_results',
--                       'profiles','audit_logs','export_jobs','spectator_orders')
--   order by tablename;
--
-- ROLLBACK (instant — drops only these 6 policies):
--   drop policy if exists tenant_isolation on public.spectator_tickets;
--   drop policy if exists tenant_isolation on public.lane_matrix;
--   drop policy if exists tenant_isolation on public.medal_results;
--   drop policy if exists tenant_isolation on public.profiles;
--   drop policy if exists tenant_isolation on public.audit_logs;
--   drop policy if exists tenant_isolation on public.export_jobs;
-- ============================================================================
