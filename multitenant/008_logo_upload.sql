-- 008_logo_upload.sql — real logo images through the whole chain (SANDBOX only)
-- =============================================================================
-- WHY
--   The console can now upload a logo image (stored as a data URL in
--   organizations.logo_url). This teaches the three functions to read/write it:
--     admin_list_orgs  -> return logo_url so the card shows the image
--     admin_save_org   -> accept p_logo_url and store it (NULL to remove)
--     get_org_branding -> return logo_url so the public page shows the image,
--                         still falling back to initials when there's no image
--
--   NOTE: storing the image as a data URL in a text column is fine for the demo.
--   In production, upload to Supabase Storage and store the public URL instead.
--
-- SAFETY: sandbox utqfugxzeqgtveiwevyi only. Adding columns to the RETURNS TABLE
--   changes the return type, so these must be DROP + CREATE (not just replace).
-- =============================================================================

-- 1) LIST — now includes logo_url.
drop function if exists public.admin_list_orgs();
create or replace function public.admin_list_orgs()
returns table(
  id uuid, name text, slug text, custom_domain text, tagline text,
  brand_primary text, brand_dark text, plan text,
  hide_powered_by boolean, logo_url text, features jsonb
)
language sql security definer set search_path = public as $$
  select id, name, slug, custom_domain, tagline,
         brand_primary, brand_dark, plan,
         coalesce(hide_powered_by,false), logo_url, coalesce(features,'{}'::jsonb)
  from public.organizations
  order by name;
$$;
grant execute on function public.admin_list_orgs() to anon, authenticated;

-- 2) SAVE — now accepts p_logo_url ('' clears it back to NULL).
drop function if exists public.admin_save_org(uuid,text,text,text,text,text,text,text,boolean,jsonb);
create or replace function public.admin_save_org(
  p_id uuid, p_name text, p_slug text, p_primary text, p_dark text,
  p_domain text, p_tagline text, p_plan text, p_hide boolean,
  p_logo_url text, p_features jsonb
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_logo text;
begin
  if coalesce(trim(p_name),'') = '' or coalesce(trim(p_slug),'') = '' then
    raise exception 'Name and slug are required';
  end if;
  select upper(string_agg(left(w,1),'')) into v_logo
  from (select w from unnest(string_to_array(regexp_replace(trim(p_name),'\s+',' ','g'),' ')) as w
        where w <> '' limit 2) s;
  if p_id is null then
    insert into public.organizations
      (slug,name,status,custom_domain,tagline,logo_text,logo_url,brand_primary,brand_dark,plan,hide_powered_by,features)
    values
      (p_slug,p_name,'active',nullif(trim(p_domain),''),nullif(trim(p_tagline),''),v_logo,
       nullif(p_logo_url,''),nullif(trim(p_primary),''),nullif(trim(p_dark),''),
       coalesce(nullif(trim(p_plan),''),'basic'),coalesce(p_hide,false),coalesce(p_features,'{}'::jsonb))
    returning id into v_id;
  else
    update public.organizations set
      slug=p_slug, name=p_name, custom_domain=nullif(trim(p_domain),''),
      tagline=nullif(trim(p_tagline),''), logo_text=coalesce(nullif(logo_text,''),v_logo),
      logo_url=nullif(p_logo_url,''),
      brand_primary=nullif(trim(p_primary),''), brand_dark=nullif(trim(p_dark),''),
      plan=coalesce(nullif(trim(p_plan),''),'basic'), hide_powered_by=coalesce(p_hide,false),
      features=coalesce(p_features,'{}'::jsonb)
    where id=p_id returning id into v_id;
    if v_id is null then raise exception 'Organisation % not found', p_id; end if;
  end if;
  return v_id;
end;
$$;
grant execute on function public.admin_save_org(uuid,text,text,text,text,text,text,text,boolean,text,jsonb) to anon, authenticated;

-- 3) PUBLIC branding lookup — now returns logo_url; keeps the initials fallback.
drop function if exists public.get_org_branding(text);
create or replace function public.get_org_branding(p_key text)
returns table(name text, slug text, logo_text text, logo_url text, brand_primary text,
              brand_dark text, tagline text, custom_domain text, hide_powered_by boolean)
language sql security definer set search_path = public as $$
  select o.name, o.slug,
         coalesce(
           nullif(o.logo_text,''),
           (select upper(string_agg(left(w,1),''))
              from (select w
                      from unnest(string_to_array(regexp_replace(trim(o.name),'\s+',' ','g'),' ')) as w
                     where w <> '' limit 2) s)
         ) as logo_text,
         o.logo_url,
         o.brand_primary, o.brand_dark, o.tagline, o.custom_domain, o.hide_powered_by
  from public.organizations o
  where o.slug = p_key or o.custom_domain = p_key
  limit 1;
$$;
grant execute on function public.get_org_branding(text) to anon, authenticated;

-- 4) Verify
select name, slug, plan, (logo_url is not null) as has_logo_image
from public.admin_list_orgs() order by name;
