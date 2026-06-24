# Go-Live Checklist — ApexAccreditPro institutional cutover

One ordered page for the whole live cutover. Each step: the command, what "good"
looks like, and rollback. Detailed runbooks linked per step. Do steps in order;
each is reversible until **Step 9**.

> Live project ref: `dixelomafeobabahqeqg` · staging: `bieqfzwljxkmmldmlzyb`
> Work from `D:\Hoda Ai Not original file\Apexaccreditpro.com-main 1` (PowerShell).
> Run LIVE commands yourself; keep VSCode auto-sync OFF.

## ✅ Pre-flight — already done
- [x] Code green: typecheck 0 · 202 tests · build PASS.
- [x] Live build isolation: **0 staging refs** in `dist`.
- [x] Branch verified a **strict superset** of live (nothing missed).
- [x] **Group A edge fns live** (dormant): public-verify-assets, verify-scanner-pin, parse-results, verify-badge.
- [x] Group B rollback backup captured in `D:\apex-prod-fn-audit`.

---

## Step 1 — Free score wins (no risk, do anytime / in parallel)
- [x] **Sentry:** Sentry React project live; `VITE_SENTRY_DSN` set in `.env` + `.env.staging`;
      staging build redeployed; test error verified landing (env=staging, w/ trace) 2026-06-22.
- [ ] **Status page:** Better Stack (free) monitor on `accreditation.apexsports.ae` + `/healthz`.
- Good: an event appears in Sentry; status page shows green. *Rollback: remove DSN.*

## Step 2 — Group B (payment functions) · gate: staging test-card
Detail: [`runbooks/STAGING_STRIPE_TEST.md`](runbooks/STAGING_STRIPE_TEST.md), [`runbooks/LIVE_EDGE_DEPLOY.md`](runbooks/LIVE_EDGE_DEPLOY.md)
- [ ] **Staging test-card first** — create a ticket on "STAGING — Demo League", pay `4242…`,
      confirm order → paid. (Validates our hardened code end-to-end.)
- [ ] **Deploy Group B to live** (low-traffic window):
  ```powershell
  $env:LIVE_ANON_KEY='<live anon>'; $env:APEX_LIVE_DEPLOY='yes'
  .\scripts\deploy-edge-live.ps1 groupB
  Remove-Item Env:\APEX_LIVE_DEPLOY
  ```
- [ ] One **live** test-card checkout → confirm fulfilment.
- Good: smokes pass; live test purchase fulfils. *Rollback: redeploy the saved prod
  copy from `D:\apex-prod-fn-audit\supabase\functions\<fn>`.*

## Step 3 — DB migration (the risky core) · rehearse first
Detail: [`runbooks/MIGRATION_REHEARSAL.md`](runbooks/MIGRATION_REHEARSAL.md) — this also logs your **restore drill**.
- [ ] Restore live backup → throwaway clone project.
- [ ] Run the **pre-apply lockout query** (must return 0 admins-without-profiles-row).
- [ ] Apply `20260650_role_trust_hardening` + `20260651_partner_api_key_hashing` on the clone; verify admins + partner keys.
- [x] **Applied to live 2026-06-22** via SQL editor (NOT db push — version 20260650/20260651
      collide with live's manually-applied live-scores migrations; `schema_migrations` tops out
      at 20260648). Pre-check green (0 admins without profiles row); post-apply all 8 admins
      resolve via `profiles.role`; `verify_partner_api_key` present. Still TODO: confirm all
      partner keys hashed before the Step 7 partner-API cutover.
- Good: every expected admin present in `profiles`; partner keys verify. *Rollback:
  re-apply prior policies (`20260612`/`20260647`); keep plaintext-key backup.*

## Step 4 — Swap the live frontend
- [ ] Build (already verified clean): `npm run build` → confirm `dist` has 0 staging refs.
- [ ] Deploy `dist` to the live host (Vercel) per your normal deploy.
- Good: site loads, admin + public pages work, faster load. *Rollback: Vercel instant
  redeploy of the previous build.*

## Step 5 — Storage → private
Detail: [`runbooks/PHASE_0_COMPLETION.md`](runbooks/PHASE_0_COMPLETION.md) §1 (signer already live)
- [ ] Set `VITE_PRIVATE_STORAGE=true` in live build → rebuild → **grep dist for 0 public-bucket URLs** → redeploy.
- [ ] Flip bucket: `update storage.buckets set public=false where id='accreditation-files';`
- [ ] Smoke: verify-page photo + PDFs, admin thumbnail, **card export** all render via signed URLs.
- Good: all assets render; no public URL works directly. *Rollback: flag→false, rebuild, bucket public.*

## Step 6 — Scanner PIN → server-side
Detail: [`runbooks/PHASE_0_COMPLETION.md`](runbooks/PHASE_0_COMPLETION.md) §4 (fn already live)
- [ ] `supabase secrets set SCANNER_DEFAULT_PIN="<pin>" --project-ref dixelomafeobabahqeqg`
- [ ] Set `VITE_SERVER_SCANNER_PIN=true` → rebuild → redeploy → soak the scanner gate.
- [ ] **Drop `VITE_SCANNER_PIN`** from the build; confirm the PIN no longer appears in any JS/network.
- Good: scanner works; PIN absent from bundle. *Rollback: flag→false.*

## Step 7 — Retire the laptop processes
Detail: [`EDGE_MIGRATION.md`](EDGE_MIGRATION.md)
- [ ] **parse-results PDF parity:** drop ≥10 real PDFs in `fixtures/hytek-pdfs/`, run
      `node scripts/parse-results-parity.mjs` (vs `medal_api.py`) → all identical.
- [ ] **Flip the flag** `VITE_EDGE_MEDAL_PARSER=true` (already wired in
      `MedalRankings.jsx`, default off) → rebuild → redeploy. Cut over the partner
      API to `verify-badge` (redeploy it `--no-verify-jwt`).
- [ ] Delete `server.js` + `server/` + `scripts/medal_api.py` once both soak.
- Good: medals + partner verify work via edge fns; nothing runs on a laptop. *Rollback: keep old paths one toggle away during soak.*

## Step 8 — Infra hardening
- [ ] `terraform apply` (infra/terraform) → prod reproducible.
- [ ] Cloudflare in front: WAF + rate-limit + DDoS (replaces server.js in-memory limiter).
- [ ] Supabase **PITR** + Supavisor pooling on.
- Good: terraform clean; WAF active; PITR enabled. *Rollback: terraform state; DNS revert.*

## Step 9 — Git-history purge (LAST · destructive)
Detail: [`GIT_HISTORY_AUDIT.md`](GIT_HISTORY_AUDIT.md)
- [ ] Freeze repo / coordinate clones → `I_UNDERSTAND_THIS_REWRITES_HISTORY=yes bash scripts/purge-git-history.sh`
- [ ] Force-push; rotate the scanner PIN.
- Good: history clean of PII/secrets/zip. *No rollback — that's why it's last; back up a mirror first.*

---

## Orphaned-function cleanup (do alongside, low priority)
- [ ] `get-photo-signed-url` is unused — confirm no external caller, then delete the deployed fn.
- [ ] `manage-users` + `migrate-photos-to-storage` — keep (source now in repo). See [`EDGE_FUNCTIONS.md`](EDGE_FUNCTIONS.md).

## Score trajectory
Steps 1–8 take you from a live ~6 → ~7.5 at near-zero spend. SSO/SAML + SOC 2
Type I (separate, paid) cross **8/10**. See [`PATH_TO_8`] / `INSTITUTIONAL_ROADMAP.md`.
