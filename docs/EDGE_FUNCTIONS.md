# Edge Functions — inventory & source-of-truth

Complete list of Supabase Edge Functions for the LIVE project
(`dixelomafeobabahqeqg`) and their status. Source for **all** of them now lives in
`supabase/functions/` (the 3 recovered ones were downloaded from prod on
2026-06-21 — they had been deployed but were never committed).

## Inventory

| Function | In repo | Deployed LIVE | App calls it? | verify_jwt | Status |
|---|---|---|---|---|---|
| `create-payment-session` | ✅ | ✅ (v9) | yes (checkout) | true | KEEP — Group B upgrade pending |
| `stripe-webhook` | ✅ | ✅ (v22) | Stripe → | **false** | KEEP — Group B upgrade pending |
| `verify-session` | ✅ | ✅ (v12) | yes (payment confirm) | true | KEEP — Group B upgrade pending |
| `send-accreditation-email` | ✅ | ✅ (v24) | yes (approval emails) | true | KEEP — Group B upgrade pending |
| `manage-users` | ✅ *(recovered)* | ✅ (v12) | **yes** — `src/lib/api/users` → `admin/Users.jsx` | (default true) | **KEEP** — core admin user CRUD |
| `migrate-photos-to-storage` | ✅ *(recovered)* | ✅ (v14) | no (manual ops tool) | (default true) | **KEEP as tool** — one-shot base64-in-DB → Storage migrator |
| `get-photo-signed-url` | ✅ *(recovered)* | ✅ (v12) | **no** — 0 invocations in either copy | (default true) | **RETIRE-ELIGIBLE** |
| `public-verify-assets` | ✅ | ✅ (Group A, 2026-06-21) | yes when `VITE_PRIVATE_STORAGE` | false | live (new) |
| `verify-scanner-pin` | ✅ | ✅ (Group A) | yes when server-PIN flag on | false | live (new, needs `SCANNER_DEFAULT_PIN`) |
| `parse-results` | ✅ | ✅ (Group A) | not cut over yet | true | live (new), PDF-parity gate pending |
| `verify-badge` | ✅ | ✅ (Group A) | partner API (not cut over) | true | live (new); redeploy `--no-verify-jwt` at cutover |

## Notes on the 3 recovered functions

### `manage-users` — KEEP
Admin user create/update/delete (auth users + `profiles`), gated to
`super_admin` / `event_admin`. Live-used by the Users admin page.
- ⚠️ **Review (not urgent):** an `event_admin` can create/delete users and set
  any `role` (incl. higher privilege). Pre-existing prod behavior — flag for a
  later least-privilege review, not a blocker.

### `migrate-photos-to-storage` — KEEP as ops tool
Finds `accreditations.photo_url` holding inline **base64** (`data:image…`) and
moves the bytes to Storage `photos/{id}.{ext}`, rewriting `photo_url` to the path.
Batched, `dry_run` supported (returns `remaining_base64`). This is the data-layer
half of "stop storing heavy blobs in the DB."
- To check if any work remains: invoke with `{ "dry_run": true }` and read
  `remaining_base64`. If 0, migration is complete (tool can be archived).

### `get-photo-signed-url` — RETIRE-ELIGIBLE
Authenticated caller → signs **any** path in `accreditation-files` (no allowlist).
- **Unused:** 0 invocations in the current app (replaced by client `getPublicUrl`
  today; by `public-verify-assets` + `resolveFileUrl` under private storage).
- **Weaker posture** than `public-verify-assets` (any authenticated user can sign
  any path they can name, incl. others' ID/medical docs — no allowlist; CORS `*`).
- **Does NOT block storage→private** (the app doesn't depend on it).
- **Action:** confirm no external/out-of-repo caller (mobile, Postman, integrations),
  then delete the deployed function. Harmless to leave until then.
