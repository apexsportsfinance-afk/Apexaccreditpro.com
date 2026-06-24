# ApexAccreditPro

Event accreditation, ticketing, live-scoring, and team-portal platform.

**Stack:** React 18 + Vite 6 · Supabase (Postgres, Auth, Storage, Edge Functions) ·
Stripe · Express API (`server.js`) · Python results bridge (being retired).

---

## Quick start
```bash
cp .env.example .env        # fill in Supabase URL + anon key + scanner PIN
npm install
npm run dev                 # frontend :5180, API :3002, bridge :5001
```

## Scripts
| Command | Purpose |
|---------|---------|
| `npm run dev` | Run frontend + API + Python bridge together |
| `npm run build` | Production build |
| `npm test` | Unit tests (Vitest) |
| `npm run test:coverage` | Coverage report |
| `npm run test:e2e` | Playwright e2e (see docs/TESTING.md) |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |

## Where things live
Start with the architecture map: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.
In short — **Entry** (`src/pages`, `server.js`, `supabase/functions`) →
**Interface** (`src/components`, `src/contexts`) →
**Data** (`src/lib`, `src/services`, `supabase/migrations`).

## Repository layout
Nearly every loose file at the root is a **tool config that must live there** — npm,
Vite, ESLint, Tailwind, PostCSS, Vitest, and Playwright all resolve their config
from the repository root. Application code lives in folders. Items marked
_git-ignored_ exist only on a local machine and are **not** part of the cloned repo
(so a checkout is tidier than a local file listing suggests).

| Path | Type | Purpose |
|------|------|---------|
| `src/` | dir | Application source — `pages`, `components`, `contexts`, `lib` |
| `public/` | dir | Static assets served as-is (PWA manifest, icons) |
| `supabase/` | dir | Edge Functions + SQL migrations |
| `infra/` | dir | Terraform IaC (dev / staging / prod) |
| `e2e/` | dir | Playwright end-to-end specs |
| `docs/` | dir | Architecture, security, privacy, runbooks, ADRs |
| `.github/` | dir | CI workflows, CODEOWNERS, security policy |
| `scripts/`, `server.js`, `server/` | legacy | Undeployed Express API + Python results bridge + upload dir — **being retired** to Edge Functions (see [docs/EDGE_MIGRATION.md](docs/EDGE_MIGRATION.md)) |
| `package.json`, `package-lock.json`, `.nvmrc` | config | Node / npm |
| `vite.config.js`, `index.html` | config | Vite build + app entry |
| `vitest.config.js`, `playwright.config.js` | config | Test runners |
| `eslint.config.js`, `.prettierrc.json` | config | Lint / format |
| `postcss.config.js`, `tailwind.config.js` | config | CSS pipeline |
| `jsconfig.json` | config | Editor / path-alias resolution |
| `vercel.json` | config | Vercel routing + security headers |
| `.env.example` | config | Env template (committed — no real secrets) |
| `.env`, `.env.local` | _git-ignored_ | Local secrets — never committed |
| `node_modules/`, `dist/` | _git-ignored_ | Installed deps / build output |

> **Do not relocate root config files.** The toolchain hard-codes root lookups;
> moving these into subfolders breaks the build, tests, and deploy for no benefit.
> The one structural cleanup that *is* planned is retiring the legacy
> `server.js` / `server/` / `scripts/` trio once the Edge migration cuts over.

## Documentation
| Doc | What |
|-----|------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How to browse the codebase |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Deployment standard (topology, envs, promotion, CI/CD) |
| [docs/STAGING_CLOUDFLARE.md](docs/STAGING_CLOUDFLARE.md) | Isolated Cloudflare Pages staging (cannot touch live) |
| [docs/SECURITY.md](docs/SECURITY.md) | Security posture & controls |
| [docs/PRIVACY.md](docs/PRIVACY.md) | Data protection & privacy |
| [docs/DATA_RETENTION.md](docs/DATA_RETENTION.md) | Retention & erasure |
| [docs/DPIA_BIOMETRICS.md](docs/DPIA_BIOMETRICS.md) | Data Protection Impact Assessment — facial recognition |
| [docs/DR_RUNBOOK.md](docs/DR_RUNBOOK.md) | Backup / disaster recovery |
| [docs/GIT_HISTORY_AUDIT.md](docs/GIT_HISTORY_AUDIT.md) | Git-history PII/secret scan + purge runbook |
| [docs/TESTING.md](docs/TESTING.md) | Tests, lint, CI |
| [docs/EDGE_MIGRATION.md](docs/EDGE_MIGRATION.md) | Express/Python → Edge Functions plan |
| [docs/INSTITUTIONAL_ROADMAP.md](docs/INSTITUTIONAL_ROADMAP.md) | Path to acquisition-grade |
| [docs/BENCHMARKS.md](docs/BENCHMARKS.md) | Scorecard vs. industry thresholds |
| [docs/MATURITY_AUDIT.md](docs/MATURITY_AUDIT.md) | Four-pillar maturity scoring (toy → enterprise) |
| [docs/adr/](docs/adr/) | Architecture Decision Records |
| [infra/terraform/README.md](infra/terraform/README.md) | Infrastructure as Code |

## Environments & deployment
- Frontend deploys to Vercel; database/auth/functions on Supabase; payments via Stripe.
- Infrastructure is codified under `infra/terraform/` (dev / staging / prod).
- Edge functions: `supabase functions deploy <name>`.

## Security
RLS is hardened (role trust is server-controlled, not JWT metadata), partner API
keys are hashed, payments use server-side price authority. See
[docs/SECURITY.md](docs/SECURITY.md). Report vulnerabilities privately to the
platform owner.

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md).
