-- ===== PHASE 6 — REPEATABLE CLIENT PROVISIONING (RPC + runbook) =====
-- Two SECURITY DEFINER functions, SUPER-ADMIN-ONLY (self-gated with
-- is_platform_admin(), since SECURITY DEFINER bypasses RLS). They make onboarding
-- a federation a known, safe sequence instead of ad-hoc SQL.
--
-- ░░ RUNBOOK — onboard one client ░░
--   STEP 1 (outside SQL): invite the client's login(s).
--     Supabase Dashboard -> Authentication -> Users -> "Invite user" (or Admin API).
--     This creates auth.users (+ a profiles row via the new-user trigger).
--     ⚠️ Set their profiles.role to a NON-super_admin role (e.g. 'admin' for their
--        org manager, 'viewer' for staff). App role never breaks isolation — the
--        restrictive tenant_isolation policy fences them to their org regardless —
--        but DON'T make a client super_admin (that bypasses everything).
--   STEP 2 (SQL): create the org + branding + assign their event(s):
--     select public.admin_provision_org(
--       p_slug => 'uaeaf', p_name => 'UAE Aquatics Federation',
--       p_custom_domain => 'accreditation.uaeaf.ae', p_plan => 'full',
--       p_brand_primary => '#0a3d62', p_tagline => 'Official Accreditation',
--       p_event_ids => array['<event-uuid-1>','<event-uuid-2>']::uuid[]);
--   STEP 3 (SQL): link each invited user to the org:
--     select public.admin_add_org_member('uaeaf','manager@uaeaf.ae','org_admin');
--     select public.admin_add_org_member('uaeaf','staff@uaeaf.ae','viewer');
--   STEP 4 (infra): point the custom domain (Vercel/Cloudflare) at the deployment;
--     branding resolves by hostname via get_org_branding. organizations.custom_domain
--     must match the hostname the client uses.
--   STEP 5 (SQL): VERIFY isolation for the new client (block at bottom of file).
--
-- ⚠️ NEVER provision a client into the 'apex' org — that is the PLATFORM org and
--    grants global-write + see-all. admin_add_org_member refuses slug 'apex'.
-- ============================================================================


-- 1) admin_provision_org — create/update an org, set branding, assign events ----
create or replace function public.admin_provision_org(
  p_slug            text,
  p_name            text,
  p_custom_domain   text    default null,
  p_plan            text    default 'standard',
  p_brand_primary   text    default null,
  p_brand_dark      text    default null,
  p_tagline         text    default null,
  p_logo_text       text    default null,
  p_hide_powered_by boolean default false,
  p_event_ids       uuid[]  default '{}'
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden: platform admin only';
  end if;
  if p_slug = 'apex' then
    raise exception 'refusing to overwrite the platform org (apex)';
  end if;

  insert into public.organizations
    (slug, name, custom_domain, plan, brand_primary, brand_dark, tagline,
     logo_text, hide_powered_by, status)
  values
    (p_slug, p_name, p_custom_domain, coalesce(p_plan,'standard'),
     p_brand_primary, p_brand_dark, p_tagline, p_logo_text,
     coalesce(p_hide_powered_by,false), 'active')
  on conflict (slug) do update set
    name            = excluded.name,
    custom_domain   = excluded.custom_domain,
    plan            = excluded.plan,
    brand_primary   = excluded.brand_primary,
    brand_dark      = excluded.brand_dark,
    tagline         = excluded.tagline,
    logo_text       = excluded.logo_text,
    hide_powered_by = excluded.hide_powered_by
  returning id into v_org;

  if array_length(p_event_ids, 1) is not null then
    update public.events set org_id = v_org where id = any(p_event_ids);
  end if;

  return v_org;
end;
$$;
revoke all on function public.admin_provision_org(text,text,text,text,text,text,text,text,boolean,uuid[]) from public;
grant execute on function public.admin_provision_org(text,text,text,text,text,text,text,text,boolean,uuid[]) to authenticated;


-- 2) admin_add_org_member — link an existing auth user (by email) to an org ------
create or replace function public.admin_add_org_member(
  p_org_slug   text,
  p_user_email text,
  p_role       text default 'org_admin'
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_user uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'forbidden: platform admin only';
  end if;
  if p_org_slug = 'apex' then
    raise exception 'refusing to add a member to the platform org (apex) via provisioning';
  end if;

  select id into v_org from public.organizations where slug = p_org_slug;
  if v_org is null then raise exception 'org not found: %', p_org_slug; end if;

  select id into v_user from auth.users where lower(email) = lower(p_user_email);
  if v_user is null then
    raise exception 'auth user not found for % — invite them (Step 1) first', p_user_email;
  end if;

  insert into public.organization_members (org_id, user_id, role)
  values (v_org, v_user, p_role)
  on conflict (org_id, user_id) do update set role = excluded.role;

  return v_user;
end;
$$;
revoke all on function public.admin_add_org_member(text,text,text) from public;
grant execute on function public.admin_add_org_member(text,text,text) to authenticated;


-- ----------------------------------------------------------------------------
-- STEP 5 — VERIFY a freshly provisioned client is isolated. Replace the email,
-- then run. EXPECT: they reach ONLY their org's events, and see 0 of any other
-- tenant's data. (Read-only; impersonates the client, no mutation.)
--   do $$
--   declare v_user uuid; c_ev bigint; c_tk bigint; c_md bigint;
--   begin
--     select id into v_user from auth.users where lower(email)=lower('manager@uaeaf.ae');
--     perform set_config('request.jwt.claim.sub', v_user::text, true);
--     perform set_config('request.jwt.claims',
--       json_build_object('sub',v_user::text,'role','authenticated')::text, true);
--     set local role authenticated;
--     select count(*) into c_ev from public.events;
--     select count(*) into c_tk from public.spectator_tickets;
--     select count(*) into c_md from public.medal_results;
--     reset role;
--     raise notice 'client reaches: % events, % tickets, % medals', c_ev, c_tk, c_md;
--   end $$;
-- ============================================================================
