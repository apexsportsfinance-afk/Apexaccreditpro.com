# Deployment Standard — ApexAccreditPro

The professional-grade deployment style this project targets. Principle:
**one managed stack, three isolated environments, git-driven promotion, nothing
running on a laptop.** This doc is the contract; `infra/terraform/` is the
implementation and [INSTITUTIONAL_ROADMAP.md](INSTITUTIONAL_ROADMAP.md) Phase 1 is
the sequencing.

---

## 1. Target topology

```
                       ┌───────────────────────────────────────────┐
   Users / Kiosks  →   │  Cloudflare  (DNS · WAF · rate-limit ·     │
                       │  DDoS · bot mgmt · edge cache)            │
                       └───────────────────┬───────────────────────┘
                                           │
                 ┌─────────────────────────┼──────────────────────────┐
                 ▼                         ▼                          ▼
        ┌────────────────┐       ┌────────────────────┐     ┌──────────────────┐
        │ Vercel         │       │ Supabase Edge Fns   │     │ Stripe Checkout  │
        │ React SPA/PWA  │       │ (Deno / TypeScript): │     │ (redirect,       │
        │ static, hashed │       │  payments · webhook  │     │  SAQ-A scope)    │
        │ immutable CDN  │       │  verify-badge        │     └──────────────────┘
        └────────────────┘       │  parse-results       │
                                 └─────────┬────────────┘
                                           ▼
                          ┌────────────────────────────────┐
                          │ Supabase Postgres               │
                          │ RLS · PITR · Supavisor pooling  │
                          │ Storage: PRIVATE + signed URLs  │
                          └────────────────────────────────┘
```

**Rules that make it "professional grade":**
- **One language family (TypeScript).** No Express, no Flask. The legacy
  `server.js` and `scripts/medal_api.py` are **retired** into Edge Functions
  (`verify-badge`, `parse-results` — already scaffolded). A SPA host like Vercel
  cannot run a long-lived Express/Flask process; keeping them means "it only runs
  on a machine somewhere," which is the #1 thing this standard removes.
- **No long-running servers to babysit.** Only static hosting + managed serverless
  + managed Postgres.
- **Edge in front of everything** (Cloudflare) for WAF, rate-limiting (the
  in-memory limiter does not survive serverless — the edge enforces it), and cache.

---

## 2. Environments — three isolated stacks

Never test against production. Each environment is a **separate Supabase project
with its own keys** and its own Stripe mode.

| Env | Frontend | Supabase project | Stripe | Data | Who/when |
|-----|----------|------------------|--------|------|----------|
| **dev** | local `vite` / Vercel preview | `apex-dev` | test | seeded fake | day-to-day |
| **staging** | Vercel **Preview** | `apex-staging` | test | seeded fake, prod-shaped | every PR; pre-release soak |
| **prod** | Vercel **Production** | `apex-prod` | **live** | real | promotion from `main` only |

> Today there is **one prod-only Supabase project** — so any test touches real
> athlete PII. Standing up `staging` (then `dev`) is the first deployment-standard
> task, and the precondition for safe testing.

---

## 3. Promotion flow (the deployment style)

Git is the deploy trigger. Artifacts are immutable; promotion is atomic.

```
local:   npm run build && npm run preview        # prod-like smoke test, seconds
  │
branch / PR  ─────────────────────────────────►  Vercel PREVIEW URL
  │   CI gates (below) run on the PR                wired to STAGING Supabase + Stripe test
  │   soak / review on the preview URL
  ▼
merge to main  ───────────────────────────────►  Vercel PRODUCTION
      DB migrations applied via gated CI step        wired to PROD Supabase + Stripe live
      → automated smoke test → done
```

You **never** deploy by editing the live environment. Every change rides a branch →
preview → merge. Rollback is selecting the previous immutable deployment.

---

## 4. CI/CD pipeline (hard gates)

Extends the existing `.github/workflows/ci.yml`.

**On every PR (must pass to merge):**
1. `npm ci`
2. `npm run lint` (ratchet → hard gate once warnings hit zero)
3. `npm test` (unit) — incl. the extracted price/parsing logic
4. `npm audit --audit-level=high`
5. `npm run build`
6. `terraform plan` (no drift surprises)
7. **Migration check** — migrations apply cleanly to a throwaway DB
8. Deploy **preview** → run e2e smoke (Playwright) against it

**On merge to `main`:**
9. Apply DB migrations to prod (`supabase db push`) — **manual approval** gate
10. Deploy **production**
11. Post-deploy smoke test (login → create accreditation → scan → test payment)
12. Keep previous deployment hot for instant rollback

---

## 5. Secrets & configuration

- **Never in the repo.** `.env*` are gitignored; only `.env.example` is committed.
- **Public (build-time):** `VITE_*` (Supabase URL, anon key, scanner PIN target)
  set per-environment in Vercel env vars. These ship in the bundle by design — put
  **no real secret** behind a `VITE_` name (move the scanner PIN check server-side).
- **Server secrets:** `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET` live in **Supabase Function secrets** / Vercel encrypted
  env, injected at deploy — never in code, never logged.
- **IaC tokens:** `TF_VAR_*` via shell env only; `*.tfvars` is gitignored
  (`*.tfvars.example` committed). Optional: Doppler / a secrets manager as the
  single source, synced into each platform.

---

## 6. Database & migrations

- Forward-only versioned SQL in `supabase/migrations/`. **Never edit an applied
  migration**; add a new one.
- Apply order: dev → staging → prod, all via CI (never hand-run on prod).
- **PITR on** (prod) for point-in-time rollback; daily backups; quarterly **tested**
  restore drill (log it in `DR_RUNBOOK.md`).
- Supavisor connection pooling on.

---

## 7. Rollback

| Layer | Rollback |
|-------|----------|
| Frontend | Vercel → promote previous deployment (instant); stale-chunk auto-reload handles cached clients |
| Edge functions | redeploy the previous version |
| Database | PITR / restore from backup (drill-tested) |
| Config/infra | `terraform apply` the previous state; tokens rotate per `DR_RUNBOOK.md` |

---

## 8. Observability & health (deploy is not "done" until this is live)

- **Sentry DSN per environment** (`VITE_SENTRY_DSN`) → errors visible.
- **Uptime monitor** on a health endpoint (`/healthz` today; an edge health route
  once `server.js` is retired) → measured SLO.
- **Public status page** + structured logs + basic tracing.

---

## 9. Performance budget (gate, ties to the "heavy/lagging" fixes)

Make speed a release gate, not an afterthought:
- Lighthouse CI (or a bundle-size check) in the pipeline; fail the build if the
  main entry chunk or LCP regresses past budget.
- Lazy-load heavy libs (face-api/TensorFlow, recharts) per route; paginate +
  narrow `select()`; virtualize long lists; serve resized images. (See the perf
  findings in the board audit.)

---

## 10. Current → target (gap)

| Aspect | Today | Target (this standard) |
|--------|-------|------------------------|
| Runtimes | SPA + **undeployed** Express + localhost Python | SPA + Supabase Edge Fns only |
| Environments | **prod only** | dev / staging / prod isolated |
| Testing path | on prod | local preview → Vercel preview on **staging** → prod |
| Edge | Vercel only | Cloudflare WAF/CDN in front |
| IaC | scaffold in `infra/terraform/` | applied, state-backed, plan-in-CI |
| Secrets | `.env` + dotenv | per-env platform secrets / manager |
| Rollback | Vercel instant (frontend only) | frontend + functions + PITR, drilled |
| Observability | seam only | Sentry + uptime + status page |

**Sequencing:** follow `infra/terraform/README.md` build-out order (state backend →
Supabase module → Vercel → Cloudflare → edge-fn deploy) and Roadmap Phase 1. Each
step is additive and `plan`-before-`apply`; nothing here requires rewriting the
product.
