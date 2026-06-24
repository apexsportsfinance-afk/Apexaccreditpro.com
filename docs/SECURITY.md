# Security Overview — ApexAccreditPro

This document records the security posture of the platform and the controls
that are in place. It is the companion to the board audit remediation.

## Authentication & Authorization

- **Identity:** Supabase Auth (email/password). Sessions are JWTs managed by the
  Supabase client.
- **Role source of truth:** `public.profiles.role` (server-controlled). RLS
  policies decide admin access through the SECURITY DEFINER helpers
  `public.is_admin()`, `public.is_super_or_event_admin()`, and
  `public.is_super_admin()` (see `supabase/migrations/20260650_role_trust_hardening.sql`).
  - Policies **must not** read `auth.jwt() -> 'user_metadata' ->> 'role'`.
    `user_metadata` is self-writable by end users (`supabase.auth.updateUser`),
    so trusting it allows privilege escalation. Always use the helpers above.
  - Users cannot change their own `profiles.role` (enforced by the
    "Users can update own profile (not role)" policy).
  - The signup trigger `handle_new_user` ignores any client-supplied admin role
    and defaults new accounts to `viewer`; privileged roles are assigned only by
    the service-role `manage-users` Edge Function.

## API tier (Express — `server.js`)

> **Deployment status (2026-06-19):** `server.js` is **not currently deployed to a
> managed production service** — it runs on a local/host machine and is slated for
> retirement; its `/api/v1/verify` and medal-parser routes are being migrated to
> Supabase Edge Functions (see `docs/EDGE_MIGRATION.md`). The controls below are
> real **in code** but are not yet enforced by managed production hosting. The
> in-memory rate limiter in particular is **per-instance** and will not hold under
> serverless/multi-instance hosting — edge/WAF rate limiting must replace it at
> cutover.

- Security headers set on every response (nosniff, frame-deny, referrer policy,
  CORP, `X-Powered-By` removed).
- CORS is an allow-list (`CORS_ALLOWED_ORIGINS`).
- Rate limiting: `/api/v1/verify` (60/min/IP) and upload routes (30/min/IP).
- All write/upload endpoints require a valid Supabase session (`requireAuth`),
  **including** `/api/bridge/results` (previously unauthenticated).
- JSON body cap of 2 MB; multipart uploads capped (20 MB docs / 5 MB photos)
  and MIME/extension filtered.
- Image serving uses `path.basename` to prevent traversal.
- `/healthz` liveness endpoint for uptime monitoring.

## Partner API keys

- Stored as a SHA-256 hash (`partner_api_keys.api_key_hash`); the plaintext is
  shown to the admin once at creation and never used for verification.
- Verification goes through the SECURITY DEFINER RPC
  `verify_partner_api_key(hash)` so the API server never needs broad read access
  to the credential table; the table is restricted to super/event admins.
- `badgeId` input is charset-validated before being used in a PostgREST filter.

## Payments (Stripe Edge Functions)

- **Server-side price authority:** charge amounts are always recomputed from the
  database (invite-link config / ticket tables); client-supplied amounts are
  never trusted.
- Webhook signatures are verified; on failure the webhook returns **400** so
  Stripe retries (no more silent drops). Idempotency is enforced via
  `stripe_event_id`.
- The webhook signing secret is never logged.

## Secrets & configuration

- No credentials are hardcoded in source. The frontend Supabase client fails
  fast if `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are missing.
- `.env` is gitignored; only `.env.example` is committed.

## Storage (migration in progress)

- **Current state (disclosed honestly):** uploaded documents (ID / passport /
  medical) and photos are served from a **public** Supabase Storage bucket via
  `getPublicUrl` — confidentiality today rests only on unguessable filenames.
- **Target state (Phase 0):** flip the bucket to **private** and serve via
  short-lived signed URLs. The helper (`src/lib/storage/signedUrl.js`) is already
  written; the cutover sweeps every `getPublicUrl` call site (×13 across 10 files).
- Until the flip lands, treat any sensitive-document URL as effectively public if
  it leaks. Tracked as a **Critical Phase-0** item in `INSTITUTIONAL_ROADMAP.md`.

## Python bridge (`scripts/medal_api.py`)

- Binds to `127.0.0.1` by default (override with `BRIDGE_HOST` only behind a
  trusted boundary).
- CORS scoped to known origins (`BRIDGE_ALLOWED_ORIGINS`).
- Does not persist extracted athlete data to disk (opt-in via `BRIDGE_DEBUG=1`).

## Dependencies

- `npm audit` is clean of Critical/High advisories. Run it in CI as a gate.
- The unmaintained, vulnerable `xlsx` package was removed; the maintained
  `@e965/xlsx` fork is used (aliased in `vite.config.js`).
- `jspdf` upgraded to v4 + `jspdf-autotable` v5 (clears the critical advisory).
- Patched transitive versions pinned via `overrides` (node-fetch, undici,
  dompurify).
- Residual: 2 moderate advisories in the `jspdf -> dompurify` chain. **Risk
  accepted**: PDFs are generated client-side from first-party admin data; the
  app does not use the `addJS`/AcroForm/JS-injection APIs the advisories target.
  Re-evaluate when an upstream patch ships.

## Reporting a vulnerability

Email security findings to the platform owner. Do not open public issues for
security reports.
