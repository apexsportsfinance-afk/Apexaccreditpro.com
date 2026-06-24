# Disaster Recovery & Incident Runbook

## Recovery objectives
| Metric | Target |
|--------|--------|
| RPO (max acceptable data loss) | ≤ 24 h (Point-in-Time Recovery if enabled: ≤ 5 min) |
| RTO (max acceptable downtime) | ≤ 4 h for core accreditation/auth |

## Backups
- **Database (Supabase):** Confirm daily automated backups are enabled, and
  enable **Point-in-Time Recovery (PITR)** on the project (Supabase Pro+). PITR
  drops RPO from 24 h to minutes.
- **Uploaded files:** Files written by `server.js` to `server/uploads/` are
  host-local and **must** be backed up. Target state: migrate uploads to
  Supabase Storage / S3 with versioning and cross-region replication.
  Interim: schedule a nightly off-host copy of `server/uploads/`.
- **Verify restores quarterly.** Record the date of the last successful test
  restore below.

  | Last tested restore | Result | By |
  |---------------------|--------|----|
  | _pending_ | _pending_ | _pending_ |

## Restore drill — Phase 0 (run ONCE now, then quarterly) ⏱️ ~20 min
The exit gate just needs **one logged drill**. Minimal version (does not touch
production data — restores into a NEW throwaway project):
1. Supabase dashboard → the project to test (staging `bieqfzwljxkmmldmlzyb` is
   fine for the drill) → **Database → Backups**.
2. Take/!pick the latest daily backup → **Restore to a new project** (or, if PITR
   is on, restore to a timestamp). Name it e.g. `apex-dr-drill-<date>`.
3. When it finishes, grab the new project's URL + anon key and smoke it:
   `node scripts/seed-staging.mjs` is NOT needed — just confirm the restored data
   is present: open SQL editor → `select count(*) from accreditations;` (expect
   the row count from the backup) and `select count(*) from auth.users;`.
4. Optionally point a local `.env.drill` at it and run the app login once.
5. **Delete the throwaway project** (cost hygiene).
6. **Fill the log table above** with today's date, "PASS/FAIL", and your name.
   That date is exactly what closes the Phase-0 restore-drill gate.

> Note: I (the assistant) cannot run this — it needs dashboard access to your
> Supabase account. The steps above are turnkey; it takes ~20 min.

## Full restore procedure (database)
1. In the Supabase dashboard, open the project → Database → Backups / PITR.
2. Restore to a new project or to a chosen timestamp.
3. Re-point `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` and the server
   `SUPABASE_*` env vars at the restored project.
4. Re-deploy edge functions (`create-payment-session`, `stripe-webhook`,
   `verify-session`, `manage-users`) and set their secrets
   (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`).
5. Re-apply migrations if restoring a schema-only target (`supabase db push`).
6. Restore `server/uploads/` from the latest off-host copy.
7. Smoke test: login, create accreditation, scan a badge, run a test payment.

## Incident response
1. **Detect** — alert from uptime monitor / error tracker, or report.
2. **Triage** — classify severity; for suspected data breach, treat as P1.
3. **Contain** — revoke compromised credentials/keys
   (`partner_api_keys.status = 'revoked'`, rotate Supabase/Stripe secrets).
4. **Eradicate & recover** — apply fix, restore from backup if needed.
5. **Notify** — for personal-data breaches, inform affected Controllers within
   **72 hours** (see `docs/PRIVACY.md` §7).
6. **Post-incident review** — record timeline, root cause, MTTR, and follow-ups.

## Key rotation
- **Supabase service role / anon keys:** rotate in dashboard; update env vars and
  redeploy.
- **Stripe keys & webhook secret:** rotate in Stripe dashboard; update function
  secrets.
- **Partner API keys:** revoke + re-issue via the Partners admin screen (keys are
  stored hashed; a new plaintext is shown once).
