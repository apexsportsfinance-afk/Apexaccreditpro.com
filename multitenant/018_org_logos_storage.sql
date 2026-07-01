-- ===== 018 — Storage bucket for org logos (LIVE) =====
-- Backs the Organizations page logo upload (Supabase Storage instead of inline
-- data URLs). Public bucket so logos render on client sites; only platform
-- super-admins can write. Run once on live.
-- ============================================================================

-- 1) public bucket
insert into storage.buckets (id, name, public)
values ('org-logos', 'org-logos', true)
on conflict (id) do update set public = true;

-- 2) super-admin write (upload / replace / delete)
drop policy if exists "org_logos super-admin write" on storage.objects;
create policy "org_logos super-admin write" on storage.objects
  for all to authenticated
  using (bucket_id = 'org-logos' and public.is_platform_admin())
  with check (bucket_id = 'org-logos' and public.is_platform_admin());

-- 3) public read (logos must render unauthenticated on client domains)
drop policy if exists "org_logos public read" on storage.objects;
create policy "org_logos public read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'org-logos');
