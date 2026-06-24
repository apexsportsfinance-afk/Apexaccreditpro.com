# Step C.2 — Flip the STAGING bucket private + turn the flag on

Turns on the private-storage mode on **staging only**. Live bucket and live flag
stay untouched until a separate, deliberate production cutover.

## Order matters
Deploy the edge function (Step C.1) and upload test files BEFORE flipping the
flag, so signed-URL rendering has something to resolve the moment the flag flips.

## 1. Upload test files to staging storage
The seed writes DB rows but no files. Upload fake assets and wire them to the
first seeded event + accreditation:
```powershell
$env:STAGING_SERVICE_ROLE_KEY = "<staging service_role JWT>"   # Settings -> API
node scripts/upload-staging-test-files.mjs
```
Note the printed `/verify/<ACC_ID>` URL — that's the record to soak.

## 2. Flip the staging bucket to PRIVATE
Supabase staging dashboard → Storage → bucket `accreditation-files` → Edit →
toggle **Public** OFF. (Or via SQL editor:)
```sql
update storage.buckets set public = false where id = 'accreditation-files';
```
RLS note: anonymous users cannot `createSignedUrl` on a private bucket — that is
exactly why the edge function exists (it signs server-side with the service
role). No extra storage RLS policy is required for the anon surfaces.

## 3. Turn the flag on in the staging build
Edit `.env.staging` (gitignored) and add/set:
```
VITE_PRIVATE_STORAGE=true
```

## 4. Rebuild + isolation grep + redeploy
```powershell
npx vite build --mode staging
# Isolation gate (MUST be 0 live / >=1 staging before deploying):
#   grep -rl dixelomafeobabahqeqg dist/   -> 0
#   grep -rl bieqfzwljxkmmldmlzyb dist/   -> >=1
npx wrangler pages deploy dist --project-name apex-staging
```
Confirm the served `/` references the just-built entry hash (Cloudflare has
served stale builds before — check content-type=javascript, not just HTTP 200).

## Rollback (instant, staging only)
- Set `VITE_PRIVATE_STORAGE=false` (or remove it) in `.env.staging`, rebuild,
  redeploy — app returns to public-URL behaviour.
- Toggle the bucket back to Public if needed.

➡ Next: `STEP_C_03_soak_checklist.md`
