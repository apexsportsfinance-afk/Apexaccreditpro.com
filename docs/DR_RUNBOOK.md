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
