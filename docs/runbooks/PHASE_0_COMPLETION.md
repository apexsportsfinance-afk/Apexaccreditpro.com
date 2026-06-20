# Phase 0 — Completion checklist (close the exit gate)

All **code** for Phase 0 is done on `feat/institutional` (staging-proven where
possible). What remains is the **cloud / process** steps that need your accounts,
secrets, and deliberate production cutovers. This is the single place that lists
them. Tick each box; the gate is closed when all are ticked.

> Safety: keep VSCode **Sync OFF** before committing (shared origin = live repo).
> Do the LIVE cutovers deliberately and one at a time, each with a quick smoke.

## 1. Storage bucket → PRIVATE on LIVE  (code ✅ / live ❌)
Staging is already private + soaked. To do the same on production:
- [ ] Deploy the signing fn to LIVE Supabase:
      `npx supabase functions deploy public-verify-assets --project-ref <LIVE_REF> --no-verify-jwt`
- [ ] Add the live Pages/host origin to the edge fn `ALLOWED_ORIGINS` (or confirm
      it's in the inlined default list).
- [ ] Set `VITE_PRIVATE_STORAGE=true` in the LIVE build env; rebuild; **grep the
      bundle for 0 live-bucket public URLs**; redeploy.
- [ ] Flip the live bucket: `update storage.buckets set public=false where id='accreditation-files';`
- [ ] Smoke on live: Verify page photo + PDFs, admin thumbnail, **card export
      (download + email/approval flow)** all render via signed URLs.
- [ ] Rollback if needed: flag back to false → rebuild → redeploy → bucket public.

## 2. Error tracking — Sentry DSN  (code ✅ / DSN ❌)
- [ ] Create a Sentry project (React).
- [ ] Set `VITE_SENTRY_DSN=<dsn>` in the staging build env, redeploy, confirm an
      event lands (throw a test error). The seam lazy-loads @sentry/react only
      when the DSN is set.
- [ ] Set `VITE_SENTRY_DSN` in the LIVE env + redeploy.

## 3. Restore drill  (procedure ✅ / drill ❌)
- [ ] Run the ~20-min drill in [`../DR_RUNBOOK.md`](../DR_RUNBOOK.md#restore-drill--phase-0-run-once-now-then-quarterly)
      and fill the "Last tested restore" log with today's date. That date closes
      the gate.

## 4. Scanner PIN → server-side  (code ✅ / cutover ❌)
- [ ] Deploy: `npx supabase functions deploy verify-scanner-pin --project-ref <REF> --no-verify-jwt` (already on staging).
- [ ] Set the secret: `npx supabase secrets set SCANNER_DEFAULT_PIN="<pin>" --project-ref <REF>`.
- [ ] Set `VITE_SERVER_SCANNER_PIN=true` in the build env, rebuild, redeploy.
- [ ] Soak the scanner gate (event PIN, global PIN, URL kiosk), then **remove
      `VITE_SCANNER_PIN` from the build** and confirm the PIN no longer appears in
      any network response or the JS bundle.
- [ ] Decide on the URL-kiosk `?pin=` path (keep server-verified, or drop) — see
      [`SCANNER_PIN_server_side.md`](SCANNER_PIN_server_side.md) open question.

## 5. Biometric — ✅ DONE
Descriptors are transient in-browser only; documented in
`BIOMETRIC_DATA_HANDLING.md` + `DPIA_BIOMETRICS.md`. No action.

## 6. Git-history purge  (verified ✅ / purge ❌ — destructive, do LAST)
Per [`../GIT_HISTORY_AUDIT.md`](../GIT_HISTORY_AUDIT.md): history contains PII
photos + a 72 MB zip + a former `.env` (`VITE_SCANNER_PIN=1234`, no live secret).
- [ ] Freeze the repo / coordinate all clones.
- [ ] Run `git filter-repo` per the audit doc; force-push.
- [ ] Rotate the scanner PIN (now moot once §4 lands).

## 7. Governance (Phase-0 tail)
- [ ] Branch protection + required CI checks + CODEOWNERS on the origin.
- [ ] Move secrets to a manager (Doppler / Vercel/CF env), confirm `.env` never in
      history (covered by §6).

---
**Exit gate is closed when:** no public sensitive-doc URLs on live (§1), error
tracking on (§2), one restore drill logged (§3), scanner PIN out of the bundle
(§4), biometric defined (§5 ✅), git-history verified+clean (§6), CI required on
the protected branch (§7).
