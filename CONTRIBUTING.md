# Contributing

## Workflow
1. Branch off `main` (`feat/…`, `fix/…`, `chore/…`).
2. Make the change; keep it small and focused.
3. Run locally before pushing:
   ```bash
   npm test
   npm run lint
   npm run build
   ```
4. Open a PR. CI must pass (see below). At least one review required.

## CI gates (`.github/workflows/ci.yml`)
**Hard gates (block merge):**
- `npm audit --audit-level=high` — no new High/Critical dependency advisories
- `npm test` — unit tests green
- `npm run build` — production build succeeds

**Ratchet (reports, non-blocking for now):**
- `npm run lint` — ESLint. Real bugs (`no-undef`, hook rules) are already errors
  and at zero. The ~570 legacy warnings are being burned down; when they reach
  ~0, flip lint to a hard gate with `--max-warnings=0`.

## Code standards
- **Tests:** add/maintain tests for pure logic. Put unit specs next to code as
  `*.test.js`; e2e specs in `e2e/`. See [docs/TESTING.md](docs/TESTING.md).
- **Formatting:** Prettier (`npm run format`). Config in `.prettierrc.json`.
- **No secrets in git.** `.env`, `*.tfvars`, and uploads are gitignored. Use the
  secrets manager / `TF_VAR_*` env vars for infra.
- **Data layer:** anything that talks to the database goes through `src/lib/api/`
  (re-exported by `src/lib/storage.js`). Don't scatter raw Supabase calls in UI.
- **Authorization:** role/permission logic lives in `src/lib/permissions.js`
  (pure + tested). RLS is the real enforcement — see `supabase/migrations/`.

## Migrations
- New DB changes = a new timestamped file in `supabase/migrations/`.
- Never edit or renumber an already-applied migration.
- Make migrations idempotent where practical (`IF NOT EXISTS`, `DROP … IF EXISTS`).

## Architecture decisions
For non-trivial choices, add a short ADR (Architecture Decision Record) under
`docs/adr/` describing context → decision → consequences.
