# LIVE Edge-Function Deploy — turnkey runbook

Deploys the 8 Supabase Edge Functions to **LIVE** (`dixelomafeobabahqeqg`) in a
safe, staged order. Driver: [`../../scripts/deploy-edge-live.sh`](../../scripts/deploy-edge-live.sh)
(DRY-RUN by default; executes only with `APEX_LIVE_DEPLOY=yes`).

> All staging parity is already proven (2026-06-21): `public-verify-assets` full
> battery green, `stripe-webhook` secret enforced, `parse-results` regex parity
> 8/8 + alive. This runbook is the LIVE cutover of that proven set.

## Blast-radius classification (why the order is safe)
The split is by **whether the LIVE frontend calls the function today**, which is
verifiable from the deployed bundle's flags — not from prod guesswork.

| Group | Functions | Live frontend uses it now? | Risk |
|-------|-----------|----------------------------|------|
| **A — additive** | `public-verify-assets`, `verify-scanner-pin`, `parse-results`, `verify-badge` | **No** — `VITE_PRIVATE_STORAGE` unset on live, scanner-PIN flag off, MedalRankings still POSTs `/api/bridge/results`, partner API still on `server.js` | **LOW** — they sit unused until a later frontend cutover |
| **B — in-prod** | `create-payment-session`, `verify-session`, `stripe-webhook`, `send-accreditation-email` | **Yes** — checkout, payment confirmation, webhook fulfilment, emails | **MED-HIGH** — replaces live customer-serving handlers |

Deploy **A first** (zero customer impact), confirm green, then **B** deliberately.

## verify_jwt (must match `supabase/config.toml`)
`--no-verify-jwt` on deploy for the 3 public fns: `public-verify-assets`,
`verify-scanner-pin`, `stripe-webhook`. The other 5 keep the JWT gateway.
⚠️ **`verify-badge` caveat:** it is JWT-gated here, but the partner API uses
`x-api-key` (no Supabase JWT). When you actually **cut the partner API over** to
the edge fn, redeploy it `--no-verify-jwt` (and add a `[functions.verify-badge]`
block to `config.toml`). Deploying it now is inert (nothing calls it).

## Procedure

### 0. Pre-flight (read-only)
```bash
bash scripts/deploy-edge-live.sh preflight
```
Confirms login, lists functions already on LIVE, and shows which secrets exist.
**Before Group A:** `SCANNER_DEFAULT_PIN`, `ALLOWED_ORIGINS`.
**Before Group B:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `ALLOWED_ORIGINS`.
Set any missing secret with:
```bash
supabase secrets set NAME="value" --project-ref dixelomafeobabahqeqg
```

### 1. Group A — additive (safe)
```bash
# dry-run first (prints exact commands, executes nothing):
bash scripts/deploy-edge-live.sh groupA
# then for real + auto-smoke:
export LIVE_ANON_KEY="<live anon JWT>"   # enables the smoke checks
APEX_LIVE_DEPLOY=yes bash scripts/deploy-edge-live.sh groupA
```
Smoke expectations: OPTIONS→200; `public-verify-assets` empty paths→`{"urls":{}}`;
`parse-results` no-files→400 "No files provided"; `verify-badge` no-key→400/401.

### 2. Group B — in-prod handlers (deliberate)
Pick a low-traffic window. Dry-run, then execute:
```bash
bash scripts/deploy-edge-live.sh groupB
APEX_LIVE_DEPLOY=yes bash scripts/deploy-edge-live.sh groupB
```
Smoke expectations (NO side effects): `stripe-webhook` no-sig→400 "Missing
signature"; `create-payment-session` bad type→400 "Invalid payment type";
`verify-session`/`send-accreditation-email` OPTIONS→200/204.

### 3. Real end-to-end confirmation (manual, after B)
- **One Stripe test-card checkout** on live (or a tiny real one you refund) →
  confirms `STRIPE_SECRET_KEY` + the webhook fulfilment path end-to-end.
- Confirm a **send-accreditation-email** actually delivers (approve one record).

## Rollback
Edge functions are versioned; redeploy the previous code to revert. Practically:
- Group A: no rollback needed (unused by the live frontend).
- Group B: keep the prior function code on a tagged commit; if a smoke fails,
  `git checkout <prev> -- supabase/functions/<fn>` and redeploy that one fn. The
  legacy paths (`server.js`, `/api/bridge/results`) are still live as a fallback
  until their separate retirement step — do NOT retire them until B has soaked.

## After this runbook
Next chain steps (separate runbooks): prod storage→private (§1 of
[`PHASE_0_COMPLETION.md`](PHASE_0_COMPLETION.md)), retire `server.js` +
`scripts/medal_api.py` (after `parse-results` PDF-parity), `terraform apply`,
Cloudflare WAF/PITR, then the git-history purge **last**.
