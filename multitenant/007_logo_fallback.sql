-- 007_logo_fallback.sql — every org always shows a clean monogram (SANDBOX only)
-- =============================================================================
-- WHY
--   The console form has no logo field, so an org can end up with an empty
--   logo_text and the registration page shows "··". This makes the public
--   branding lookup derive initials from the org name as a fallback, and
--   backfills any existing orgs that are missing a logo.
--
-- SAFETY: sandbox utqfugxzeqgtveiwevyi only. Idempotent (create or replace).
-- =============================================================================

-- 1) Public branding lookup with an initials fallback for logo_text.
create or replace function public.get_org_branding(p_key text)
returns table(name text, slug text, logo_text text, brand_primary text,
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
         o.brand_primary, o.brand_dark, o.tagline, o.custom_domain, o.hide_powered_by
  from public.organizations o
  where o.slug = p_key or o.custom_domain = p_key
  limit 1;
$$;
grant execute on function public.get_org_branding(text) to anon, authenticated;

-- 2) Backfill existing orgs that have no logo_text (e.g. UAE Aquatics).
update public.organizations set logo_text = (
  select upper(string_agg(left(w,1),''))
    from (select w
            from unnest(string_to_array(regexp_replace(trim(name),'\s+',' ','g'),' ')) as w
           where w <> '' limit 2) s)
where coalesce(logo_text,'') = '';

-- 3) Verify — every row should now have a logo_text.
select name, slug, logo_text, brand_primary from public.organizations order by name;
