# Testing & Code Quality

## Commands
| Command | What it does |
|---------|--------------|
| `npm test` | Run the unit suite (Vitest) once |
| `npm run test:watch` | Watch mode while developing |
| `npm run test:coverage` | Coverage report (text + `coverage/index.html`) |
| `npm run test:e2e` | Playwright end-to-end (needs the app running, see below) |
| `npm run lint` | ESLint over `src` |
| `npm run lint:fix` | ESLint with autofix |
| `npm run format` | Prettier write |
| `npm run format:check` | Prettier check (no writes) |

## Unit tests (Vitest + jsdom)
- Specs live next to code as `*.test.js` under `src/`.
- Config: `vitest.config.js`; global setup: `src/test/setup.js`.
- Current coverage focuses on the highest-risk pure logic:
  - `src/lib/permissions.test.js` — authorization rules (extracted from AuthContext)
  - `src/lib/utils.test.js` — age, badge numbers, phone/file validation
  - `src/lib/expiryUtils.test.js` — accreditation expiry computation
  - `src/lib/apiHelpers.test.js` — Supabase response/retry handling

**Next targets:** ticketing price math, fixture generators, broadcast/email
template rendering, and RLS policy tests against a throwaway Supabase project.

## End-to-end (Playwright)
Specs live in `e2e/` (kept out of `src/` so Vitest ignores them). One-time setup:
```bash
npm i -D @playwright/test
npx playwright install chromium
```
Run:
```bash
npm run dev        # app on http://localhost:5180
npm run test:e2e   # in a second terminal
```
`e2e/smoke.spec.js` is a starter; grow it into the critical journeys:
login → dashboard, badge scan, and a test Stripe checkout.

## Linting policy (the ratchet)
ESLint is configured in `eslint.config.js`. Real correctness problems are
**errors**; legacy stylistic debt is **warnings** so the signal isn't drowned.

- `no-undef` is an **error** and is currently at **zero** — it already caught two
  live bugs (a missing `ZonesAPI` import that broke attendance loading, and an
  out-of-scope `r` in the email composer) plus an unwired "clubs import" feature
  with no state declarations. All fixed.
- CI runs lint with `continue-on-error: true` (reports, doesn't block) while the
  ~570 warnings (mostly `no-unused-vars` and `react-hooks/exhaustive-deps`) are
  burned down. **When warnings reach ~0, flip CI lint to a hard gate** and add
  `--max-warnings=0`.

## CI gates (`.github/workflows/ci.yml`)
Hard gates (block merge): `npm audit --audit-level=high`, `npm test`, `npm run build`.
Ratchet (informational): `npm run lint`.
