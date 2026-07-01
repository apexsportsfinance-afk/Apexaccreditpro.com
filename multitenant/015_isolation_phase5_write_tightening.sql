-- ===== PHASE 5 — TIGHTEN WRITES (block cross-tenant / global writes by clients) =====
-- Gap: 013's reusable policy allows ANY authenticated user to write a row with
-- event_id IS NULL — which becomes a platform-global row visible to every tenant.
-- Left open so Apex's global-config workflows wouldn't break. Before onboarding a
-- real client we must ensure only the PLATFORM (Apex) can create global rows.
--
-- Rule after this migration (WRITE / with_check):
--   super_admin .......... anything (bypass)
--   apex-org member ...... own-event rows  +  global (event_id NULL) rows
--   client-org member .... own-event rows ONLY  (no NULL, no other tenant's events)
-- READS are unchanged (global rows stay readable — clients still need defaults).
--
-- NON-BREAKING TODAY: every current user is an apex-org member, so every current
-- write path still passes. Only future client orgs are constrained.
-- ============================================================================


-- 1) Helper: is the current user a member of the PLATFORM org (Apex)? -----------
--    SECURITY DEFINER so it bypasses organization_members' own RLS.
--    ⚠️ Couples "platform" to org slug 'apex'. If that ever changes, update here
--    (cleaner long-term: an organizations.is_platform boolean flag).
create or replace function public.is_platform_org_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_members m
    join public.organizations o on o.id = m.org_id
    where m.user_id = auth.uid() and o.slug = 'apex'
  );
$$;
grant execute on function public.is_platform_org_member() to authenticated;


-- 2) Re-define the reusable isolation layer with a TIGHTER with_check ------------
--    USING (read) unchanged. with_check now gates NULL-event_id writes to the
--    platform org only.
create or replace function public.apply_tenant_isolation(p_table text)
returns void language plpgsql as $$
begin
  execute format('alter table public.%I enable row level security;', p_table);
  execute format('drop policy if exists tenant_isolation on public.%I;', p_table);
  execute format($f$
    create policy tenant_isolation on public.%I
      as restrictive for all to authenticated
      using ( public.is_platform_admin()
              or event_id is null
              or event_id::text in (select e::text from public.my_event_ids() e) )
      with check ( public.is_platform_admin()
                   or (event_id is null and public.is_platform_org_member())
                   or (event_id is not null
                       and event_id::text in (select e::text from public.my_event_ids() e)) );
  $f$, p_table);
end;
$$;


-- 3) Re-apply to EVERY event-scoped table (same self-discovering loop as 013) ----
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


-- ----------------------------------------------------------------------------
-- VERIFY (self-cleaning, NON-mutating to data): temporarily moves a real apex
-- user into a throwaway org and asks, per perspective, "can you write a global
-- (NULL-event_id) row?" = is_platform_admin() OR is_platform_org_member().
-- EXPECT: client(other org) -> can_write_global = false, events_reachable = 0;
--         apex staff        -> can_write_global = true;
--         super_admin       -> can_write_global = true.
--   (run the block in the chat — it restores membership + drops the temp org.)
-- ============================================================================
