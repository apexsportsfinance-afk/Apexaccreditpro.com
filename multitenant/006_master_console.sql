-- 006_master_console.sql — back the Master Console with real DB writes (SANDBOX only)
-- =============================================================================
-- WHAT THIS DOES
--   master-console.html calls three RPCs that don't exist yet. This file
--   creates them so an Apex master can CREATE / EDIT / DELETE organisations and
--   set branding + package + per-org features live — and the branding demo
--   instantly reflects the change.
--
--     admin_list_orgs()   -> every org with branding/plan/features
--     admin_save_org(...) -> insert (p_id null) or update an org
--     admin_delete_org()  -> remove an org (fails if it still owns data)
--
-- SAFETY
--   * Sandbox project utqfugxzeqgtveiwevyi ONLY. Never live.
--   * SECURITY DEFINER + granted to anon because the console uses the public
--     anon key (no login). Acceptable for the demo sandbox; the real app will
--     gate these behind is_platform_admin().
--   * Idempotent: safe to re-run.
-- =============================================================================

-- 0) The console offers a 'full' package; the table CHECK predates it. Widen it
--    so saving a 'full' org doesn't violate the constraint.
alter table public.organizations drop constraint if exists organizations_plan_check;
alter table public.organizations add constraint organizations_plan_check
  check (plan in ('basic','standard','premium','full','enterprise'));

-- 1) LIST — return every org with exactly the fields the card renders.
create or replace function public.admin_list_orgs()
returns table(
  id uuid, name text, slug text, custom_domain text, tagline text,
  brand_primary text, brand_dark text, plan text,
  hide_powered_by boolean, features jsonb
)
language sql security definer set search_path = public as $$
  select id, name, slug, custom_domain, tagline,
         brand_primary, brand_dark, plan,
         coalesce(hide_powered_by,false), coalesce(features,'{}'::jsonb)
  from public.organizations
  order by created_at nulls first, name;
$$;

-- 2) SAVE — upsert. p_id null = create, otherwise update that row.
--    Empty strings are coerced to NULL so the unique custom_domain index and
--    optional fields behave. logo_text is auto-derived from the name initials
--    when the console doesn't supply one (it has no logo field today).
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
  p_features jsonb
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id    uuid;
  v_logo  text;
begin
  if coalesce(trim(p_name),'') = '' or coalesce(trim(p_slug),'') = '' then
    raise exception 'Name and slug are required';
  end if;

  -- initials of the first two words, e.g. "Demo Federation" -> "DF"
  select upper(string_agg(left(w,1),''))
    into v_logo
  from (
    select w from unnest(string_to_array(regexp_replace(trim(p_name),'\s+',' ','g'),' ')) as w
    where w <> '' limit 2
  ) s;

  if p_id is null then
    insert into public.organizations
      (slug, name, status, custom_domain, tagline, logo_text,
       brand_primary, brand_dark, plan, hide_powered_by, features)
    values
      (p_slug, p_name, 'active', nullif(trim(p_domain),''), nullif(trim(p_tagline),''), v_logo,
       nullif(trim(p_primary),''), nullif(trim(p_dark),''),
       coalesce(nullif(trim(p_plan),''),'basic'), coalesce(p_hide,false),
       coalesce(p_features,'{}'::jsonb))
    returning id into v_id;
  else
    update public.organizations set
      slug            = p_slug,
      name            = p_name,
      custom_domain   = nullif(trim(p_domain),''),
      tagline         = nullif(trim(p_tagline),''),
      logo_text       = coalesce(nullif(logo_text,''), v_logo),
      brand_primary   = nullif(trim(p_primary),''),
      brand_dark      = nullif(trim(p_dark),''),
      plan            = coalesce(nullif(trim(p_plan),''),'basic'),
      hide_powered_by = coalesce(p_hide,false),
      features        = coalesce(p_features,'{}'::jsonb)
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Organisation % not found', p_id;
    end if;
  end if;

  return v_id;
end;
$$;

-- 3) DELETE — remove an org. Members cascade; if the org still owns events or
--    other org_id data with a RESTRICT FK, the delete fails loudly (intended).
create or replace function public.admin_delete_org(p_id uuid)
returns void
language sql security definer set search_path = public as $$
  delete from public.organizations where id = p_id;
$$;

-- 4) Grants — the console uses the anon key (sandbox demo only).
grant execute on function public.admin_list_orgs()                                   to anon, authenticated;
grant execute on function public.admin_save_org(uuid,text,text,text,text,text,text,text,boolean,jsonb) to anon, authenticated;
grant execute on function public.admin_delete_org(uuid)                              to anon, authenticated;

-- 5) Verify — should list your existing demo orgs through the new function.
select name, slug, plan, hide_powered_by, jsonb_object_keys(features) as a_feature
from public.admin_list_orgs()
order by name;
