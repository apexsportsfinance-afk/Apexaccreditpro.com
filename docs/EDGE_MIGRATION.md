# Edge Migration & Express Retirement Plan

Goal: move the partner verification API (and later the medal parser) off the
undeployed `server.js` (Express) onto Supabase Edge Functions, so no service
runs outside managed hosting — **without breaking the partner integration**.

Principle: **strangler pattern.** The new edge function runs alongside the old
Express endpoint; we only cut traffic over after byte-for-byte parity is proven,
and we keep the old path one toggle away for rollback.

---

## Stage 1 — `verify-badge` (scaffolded)
New function: `supabase/functions/verify-badge/index.ts` — a faithful port of
`server.js` `/api/v1/verify`. Express endpoint stays live.

### Deploy (no cutover yet)
```bash
supabase functions deploy verify-badge
supabase secrets set ALLOWED_ORIGINS="https://accreditation.apexsports.ae"
# SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided by the platform.
```

### Parity checklist (must be 100% before cutover)
Run the same inputs against both `POST /api/v1/verify` (Express) and the edge
function, and diff the JSON responses + status codes:

- [ ] Missing `x-api-key` -> `401` + identical error body
- [ ] Missing `badgeId` -> `400`
- [ ] `badgeId` with illegal chars (e.g. `a' or '1=1`) -> `400` "Invalid badgeId format"
- [ ] Revoked / unknown key -> `403`
- [ ] Valid key + unknown badge -> `404`
- [ ] Valid key + valid badge -> `200`, and the returned object contains **exactly**
      the key's `allowed_fields` (no more, no less)
- [ ] `bookingData` parses identically when `custom_message` is a JSON string
- [ ] `last_used_at` is stamped on the key after a successful call
- [ ] CORS headers match for an allowed and a disallowed origin

### Cutover
1. Point partners / the APIDocs base URL at the function URL
   (`https://<project>.functions.supabase.co/verify-badge`).
2. Soak for a defined window (e.g. 1 week) watching error rates.
3. Remove the `/api/v1/verify` route from `server.js`.

### Rollback
Re-point the base URL back to the Express host. Keep the Express route until the
soak window passes.

---

## Stage 2 — Medal parser (`parse-results`) — parser ported & tested
The risky part (the Hy-Tek regex parsing) is done and **unit-tested for parity**:
- Canonical logic: `supabase/functions/_shared/hytekParser.ts` — a faithful port
  of `parse_hytek_text` in `scripts/medal_api.py`.
- Tests: `supabase/functions/_shared/hytekParser.test.ts` (8 tests, green) cover
  headers (gender/age/distance, `(Event …)` form), podium-only placements (1–3,
  skip 4+), relay detection, pre-header rows ignored, and the competition-name
  default.
- Edge function: `supabase/functions/parse-results/index.ts` wraps the parser
  with PDF text extraction via `unpdf` (Deno) and the same multipart contract as
  the Python endpoint (`files[]` + `competition_name` → `{ success, results }`).

### Staging status (verified 2026-06-21)
- Deployed to staging (`bieqfzwljxkmmldmlzyb`) and **alive**: OPTIONS→200, POST
  with no files→`400 "No files provided"`. (GET→401 is the gateway requiring a
  JWT — correct; `parse-results` is admin-invoked, not public.)
- **Regex parity 8/8 green** (`supabase/functions/_shared/hytekParser.test.ts`,
  part of the vitest suite).
- **NOT cut over** (correct): `src/pages/admin/MedalRankings.jsx:141` still POSTs
  `/api/bridge/results`. ⚠️ That path 404s on the static Pages deploy (no
  `server.js`), so it can't be exercised through the staging UI — test the
  function with **direct POSTs of real PDFs**, not via the admin upload, until
  cutover.

### Remaining parity gate (before cutover)
The regex is proven; what's left is **PDF-extraction parity** (pypdf layout mode
vs unpdf can differ in whitespace/column handling):
1. Build a fixture set of ≥10 real result PDFs.
2. Run each through the Python service and the deployed `parse-results`.
3. Assert the parsed JSON (events, places, swimmers, times) is identical.
4. Only then cut `MedalRankings.jsx`'s `/api/bridge/results` call over to the
   function URL. Keep the Python service until the soak window passes.

---

## End state
- `server.js` and `scripts/medal_api.py` deleted.
- All server-side logic in Supabase Edge Functions (one TS stack).
- Nothing to deploy or babysit on a laptop/VM.
