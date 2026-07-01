-- 005_branding.sql  — make branding live from the DB (run in SANDBOX only)
-- Adds branding columns, seeds the two demo orgs, exposes a safe public lookup.

-- 1) Branding columns on the organizations table (safe to re-run)
alter table public.organizations add column if not exists slug            text;
alter table public.organizations add column if not exists logo_text       text;
alter table public.organizations add column if not exists brand_primary   text;
alter table public.organizations add column if not exists brand_dark      text;
alter table public.organizations add column if not exists tagline         text;
alter table public.organizations add column if not exists custom_domain   text;
alter table public.organizations add column if not exists hide_powered_by boolean default false;

-- 2) Seed branding for the two demo orgs (match by name, no ID guessing)
update public.organizations set
  slug='demofc', logo_text='FC', brand_primary='#0B5FFF', brand_dark='#073db0',
  tagline='Official Event Registration', custom_domain='demofc.apexsmart.com',
  hide_powered_by=false
where name ilike '%FC%';

update public.organizations set
  slug='demofed', logo_text='DF', brand_primary='#16a34a', brand_dark='#0f7a37',
  tagline='National Championship Portal', custom_domain='events.demofederation.com',
  hide_powered_by=true
where name ilike '%fed%';

-- 3) Safe PUBLIC lookup: returns ONLY branding fields (no private data),
--    callable by anonymous visitors of a registration page.
create or replace function public.get_org_branding(p_key text)
returns table(name text, slug text, logo_text text, brand_primary text,
              brand_dark text, tagline text, custom_domain text, hide_powered_by boolean)
language sql security definer set search_path = public as $$
  select name, slug, logo_text, brand_primary, brand_dark, tagline, custom_domain, hide_powered_by
  from public.organizations
  where slug = p_key or custom_domain = p_key
  limit 1;
$$;
grant execute on function public.get_org_branding(text) to anon, authenticated;

-- 4) Verify
select name, slug, brand_primary, custom_domain, hide_powered_by
from public.organizations order by name;
