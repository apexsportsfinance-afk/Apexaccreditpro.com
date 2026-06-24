-- Staging storage setup — create the one bucket the app uses + functional RLS.
--
-- Context: the staging schema was mirrored from live with
--   pg_dump --schema=public  (see supabase/schema.live.sql)
-- which does NOT include the `storage` schema. So a fresh staging project has the
-- default storage.buckets/objects tables but: (a) no `accreditation-files` bucket
-- row, and (b) none of live's storage RLS policies (those were created in the live
-- dashboard and are not in any migration, so they could not be mirrored).
--
-- This script recreates a FUNCTIONAL equivalent for staging testing. It is NOT a
-- byte-exact copy of live's policies (those are unknown). That is acceptable: the
-- bucket is PUBLIC on live today (served via getPublicUrl), and the private-bucket
-- flip is a separate, flag-gated cutover (VITE_PRIVATE_STORAGE). For staging we
-- match live's CURRENT public behaviour so functional regression is meaningful.
--
-- Idempotent: safe to run repeatedly. STAGING ONLY — never run against live.

-- 1) The bucket. Public, matching live's current served-via-getPublicUrl behaviour.
insert into storage.buckets (id, name, public)
values ('accreditation-files', 'accreditation-files', true)
on conflict (id) do update set public = excluded.public;

-- 2) RLS policies on storage.objects, scoped to this bucket.
--    Drop-then-create so reruns converge.

-- Public read (anon + authenticated). Harmless for a public bucket; lets the
-- client list/download in addition to the getPublicUrl CDN path.
drop policy if exists "accreditation-files public read" on storage.objects;
create policy "accreditation-files public read"
  on storage.objects for select
  using (bucket_id = 'accreditation-files');

-- Authenticated write (insert/update/delete). The app uploads as a signed-in user.
drop policy if exists "accreditation-files auth insert" on storage.objects;
create policy "accreditation-files auth insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'accreditation-files');

drop policy if exists "accreditation-files auth update" on storage.objects;
create policy "accreditation-files auth update"
  on storage.objects for update to authenticated
  using (bucket_id = 'accreditation-files')
  with check (bucket_id = 'accreditation-files');

drop policy if exists "accreditation-files auth delete" on storage.objects;
create policy "accreditation-files auth delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'accreditation-files');

-- 3) Verify (psql will print these on apply).
select id, name, public from storage.buckets where id = 'accreditation-files';
select policyname, cmd from pg_policies
  where schemaname = 'storage' and tablename = 'objects'
    and policyname like 'accreditation-files%'
  order by policyname;
