-- ===== 017 — MASTER CONSOLE RPCs for LIVE (super-admin-gated) =====
-- Live-safe versions of the sandbox console RPCs (006/008). Every function
-- SELF-GATES on is_platform_admin() (SECURITY DEFINER bypasses RLS, so the gate
-- must be inside). Granted to `authenticated` only, REVOKED from anon/public —
-- so a logged-in super-admin can manage orgs, and nobody else can.
--
-- Backs master-console-live.html (run locally, log in as super-admin).
--   admin_list_orgs()        -> every org + branding/plan/features (read)
--   admin_save_org(...)      -> create/update an org (branding+plan+features+logo)
--   admin_delete_org(id)     -> delete an org (fails if it still owns data)
--   admin_link_user(...)     -> set a user's app role + add them to an org
-- (admin_provision_org / admin_add_org_member from 016 remain valid too.)
-- ============================================================================

-- 1) LIST -----------------------------------------------------------------------
create or replace function public.admin_list_orgs()
returns table(
  id uuid, name text, slug text, custom_domain text, tagline text,
  brand_primary text, brand_dark text, plan text,
  hide_powered_by boolean, features jsonb, logo_url text
)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden: platform admin only'; end if;
  return query
    select o.id, o.name, o.slug, o.custom_domain, o.tagline,
           o.brand_primary, o.brand_dark, o.plan,
           coalesce(o.hide_powered_by,false), coalesce(o.features,'{}'::jsonb), o.logo_url
    from public.organizations o
    order by o.created_at nulls first, o.name;
end;
$$;

-- 2) SAVE (upsert) --------------------------------------------------------------
--    p_id null = create; otherwise update that row. Refuses to touch 'apex'.
create or replace function public.admin_save_org(
  p_id       uuid,
  p_name     text,
  p_slug     text,
  p_primary  text,
  p_dark     text,
  p_domain   text,
  p_tagline  text,
  p_plan     text,
  p_hide     boolean,
  p_features jsonb,
  p_logo_url text
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_logo text;
begin
  if not public.is_platform_admin() then raise exception 'forbidden: platform admin only'; end if;
  if coalesce(trim(p_name),'') = '' or coalesce(trim(p_slug),'') = '' then
    raise exception 'Name and slug are required';
  end if;
  if lower(trim(p_slug)) = 'apex' then raise exception 'refusing to edit the platform org (apex)'; end if;

  -- initials of first two words for the monogram fallback
  select upper(string_agg(left(w,1),'')) into v_logo
  from (select w from unnest(string_to_array(regexp_replace(trim(p_name),'\s+',' ','g'),' ')) as w
        where w <> '' limit 2) s;

  if p_id is null then
    insert into public.organizations
      (slug, name, status, custom_domain, tagline, logo_text, logo_url,
       brand_primary, brand_dark, plan, hide_powered_by, features)
    values
      (p_slug, p_name, 'active', nullif(trim(p_domain),''), nullif(trim(p_tagline),''), v_logo,
       nullif(trim(p_logo_url),''), nullif(trim(p_primary),''), nullif(trim(p_dark),''),
       coalesce(nullif(trim(p_plan),''),'basic'), coalesce(p_hide,false), coalesce(p_features,'{}'::jsonb))
    returning id into v_id;
  else
    update public.organizations set
      slug=p_slug, name=p_name,
      custom_domain=nullif(trim(p_domain),''), tagline=nullif(trim(p_tagline),''),
      logo_text=coalesce(nullif(logo_text,''), v_logo),
      logo_url=nullif(trim(p_logo_url),''),
      brand_primary=nullif(trim(p_primary),''), brand_dark=nullif(trim(p_dark),''),
      plan=coalesce(nullif(trim(p_plan),''),'basic'), hide_powered_by=coalesce(p_hide,false),
      features=coalesce(p_features,'{}'::jsonb)
    where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'Organisation % not found', p_id; end if;
  end if;
  return v_id;
end;
$$;

-- 3) DELETE ---------------------------------------------------------------------
create or replace function public.admin_delete_org(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'forbidden: platform admin only'; end if;
  if exists (select 1 from public.organizations where id = p_id and slug = 'apex') then
    raise exception 'refusing to delete the platform org (apex)';
  end if;
  delete from public.organizations where id = p_id;
end;
$$;

-- 4) LINK USER — set a user's app role + attach them to an org ------------------
--    The one action that makes a client login work: app role (e.g. 'admin') so
--    they can manage events + org membership so they're isolated. Refuses
--    super_admin (would bypass isolation) and the apex org.
create or replace function public.admin_link_user(
  p_email    text,
  p_org_slug text,
  p_app_role text default 'admin',
  p_org_role text default 'org_admin'
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_user uuid;
begin
  if not public.is_platform_admin() then raise exception 'forbidden: platform admin only'; end if;
  if lower(trim(p_org_slug)) = 'apex' then raise exception 'refusing to attach to the platform org (apex)'; end if;
  if lower(trim(p_app_role)) = 'super_admin' then raise exception 'cannot grant super_admin to a client user'; end if;

  select id into v_org from public.organizations where slug = p_org_slug;
  if v_org is null then raise exception 'org not found: %', p_org_slug; end if;
  select id into v_user from auth.users where lower(email) = lower(p_email);
  if v_user is null then raise exception 'auth user not found for % — create them in Supabase Auth first', p_email; end if;

  update public.profiles set role = p_app_role where id = v_user;
  insert into public.organization_members (org_id, user_id, role)
  values (v_org, v_user, p_org_role)
  on conflict (org_id, user_id) do update set role = excluded.role;
  return v_user;
end;
$$;

-- 5) GRANTS — authenticated only; the internal is_platform_admin() gate does the
--    real work. Explicitly revoke from anon/public.
revoke all on function public.admin_list_orgs()                                                     from public;
revoke all on function public.admin_save_org(uuid,text,text,text,text,text,text,text,boolean,jsonb,text) from public;
revoke all on function public.admin_delete_org(uuid)                                                from public;
revoke all on function public.admin_link_user(text,text,text,text)                                  from public;
grant execute on function public.admin_list_orgs()                                                     to authenticated;
grant execute on function public.admin_save_org(uuid,text,text,text,text,text,text,text,boolean,jsonb,text) to authenticated;
grant execute on function public.admin_delete_org(uuid)                                                to authenticated;
grant execute on function public.admin_link_user(text,text,text,text)                                  to authenticated;
