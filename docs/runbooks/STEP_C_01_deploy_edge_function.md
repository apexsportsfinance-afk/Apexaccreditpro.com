# Step C.1 — Deploy `public-verify-assets` to STAGING

Deploys the public signed-URL edge function to the **staging** Supabase project
only. The live project is never touched here.

## Facts
- Staging project ref: `bieqfzwljxkmmldmlzyb` (URL `https://bieqfzwljxkmmldmlzyb.supabase.co`)
- Live project ref (NEVER deploy here): `dixelomafeobabahqeqg`
- Function source: `supabase/functions/public-verify-assets/index.ts`
- Must be PUBLIC (no JWT): `verify_jwt = false` is already set in `supabase/config.toml`.
- CORS allowlist is inlined and already includes `https://apex-staging-2ft.pages.dev`
  + localhost. To add more origins later, set the `ALLOWED_ORIGINS` secret (CSV).

## Prereqs
- Supabase CLI (used via `npx supabase@latest`, no global install).
- A Supabase **access token** to authenticate the CLI — get it from
  https://supabase.com/dashboard/account/tokens (personal access token).
  Do NOT paste it in chat. Use it as an env var for the session only.

## Commands (PowerShell, repo root)
```powershell
# 1. Authenticate the CLI for this session (token is secret — env var only).
$env:SUPABASE_ACCESS_TOKEN = "<your personal access token>"

# 2. Deploy the function to STAGING, public (no JWT verification).
npx supabase@latest functions deploy public-verify-assets `
  --project-ref bieqfzwljxkmmldmlzyb --no-verify-jwt

# 3. (Optional) widen CORS later without redeploying code:
#    npx supabase@latest secrets set ALLOWED_ORIGINS="https://extra.example" --project-ref bieqfzwljxkmmldmlzyb
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically by the
Supabase platform into deployed functions — you do NOT set those yourself.

## Smoke test (curl) — proves it's public, CORS-correct, and anti-oracle
```bash
# Replace <ACC_ID> with a seeded accreditation id (see Step C.3 / uploader output).
curl -s -X POST \
  "https://bieqfzwljxkmmldmlzyb.functions.supabase.co/public-verify-assets" \
  -H "Content-Type: application/json" \
  -H "Origin: https://apex-staging-2ft.pages.dev" \
  -d '{"accreditationId":"<ACC_ID>","scope":"profile","paths":["staging-test/photo.png"]}'
# EXPECT: {"urls":{"staging-test/photo.png":"https://...token=..."}}  (a signed URL)

# Anti-oracle proof: a path NOT on this accreditation must NOT be signed.
curl -s -X POST \
  "https://bieqfzwljxkmmldmlzyb.functions.supabase.co/public-verify-assets" \
  -H "Content-Type: application/json" \
  -d '{"accreditationId":"<ACC_ID>","scope":"profile","paths":["passports/someone-else.jpg"]}'
# EXPECT: {"urls":{}}  (empty — the server refused to sign an off-allowlist path)
```

## Success criteria
- Deploy reports success; function appears in staging dashboard → Edge Functions.
- First curl returns a signed URL; second returns `{"urls":{}}`.

➡ Next: `STEP_C_02_private_bucket_cutover.md`
