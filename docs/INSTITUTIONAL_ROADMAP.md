# Institutional Readiness Roadmap — ApexAccreditPro → $500K+ Asset

Purpose: take this product from "advanced MVP, solo-built" to "institutional,
acquisition-grade SaaS" with a defensible **$500K+** valuation. Every workstream
below maps to a concrete finding from the due-diligence review, with effort and
the **risk of doing it** called out (so nothing here is a blind change).

> Reality check on the number: $500K is reached on **business + asset quality
> together**. Code hygiene alone gets you to "buyable"; it's **traction (ARR),
> SOC 2, clean IP, deployable infra, and no key-person risk** that move the
> price from a code-asset multiple to a strategic one. This plan builds all of
> them.

> **Revision 2026-06-19 (20-expert board re-audit):** six adjustments folded in —
> (1) private-storage flip promoted to **Phase 0** (it's a *live* PII exposure,
> not future work); (2) the git-history purge is now **verify-first** (confirm the
> history actually contains PII against the real origin before any rewrite);
> (3) edge/WAF **rate limiting** added as an explicit edge-migration exit gate
> (the in-memory limiter dies in serverless); (4) **biometric DPIA** pulled
> earlier (Art. 9 / PDPL special-category data); (5) **Sentry DSN + one restore
> drill** moved to **Day 1** (cheapest, highest-ROI unlocks); (6) a standing
> **doc-reconciliation** checkpoint (stale security/dependency docs read as
> misleading in due diligence).

> **Progress update — 2026-06-19 (session 2, on `feat/institutional`, local-only,
> nothing pushed; live untouched):**
> - **Plan 3 / tests:** 113 → **127 Vitest tests**, 0 lint errors, CI gate green.
> - **Phase 2 bundle diet — ✅ DONE & verified on staging:** QR route chunk
>   **877 KB → 7 KB** (lazy tab panels + lazy face-api), recharts pulled off the
>   Dashboard critical path, export libs (jspdf/html2canvas/xlsx) load only on the
>   export action. (Roadmap §2 Phase-2 line — see below.)
> - **Phase 1 staging — ✅ stood up & deploy verified:** isolated staging Supabase
>   (`bieqfzwljxkmmldmlzyb`) + Cloudflare Pages (`apex-staging-2ft.pages.dev`),
>   seeded; the served bundle is SHA-identical to the committed build with **0 live
>   refs** (isolation pre-flight passes).
> - **Phase 0 storage flip — 🟡 MIGRATION ACTIVE (not yet flipped):** resolver is now
>   legacy-URL-safe; client render primitives built; 3 render batches migrated. See
>   the Phase 0 Day-1 row for the detailed state and what remains.

---

## 0. The Valuation Bridge — what each gap is "costing" you today

| Dimension | Today | Institutional target | Why it moves price |
|-----------|-------|----------------------|--------------------|
| IP cleanliness | PII + 70 MB zip in git history | Clean, audited history; CLA/IP assignment | Buyers won't assume GDPR/biometric liability |
| Infrastructure | Vercel SPA + undeployed Express/Flask | One managed, reproducible (IaC) stack | "It runs without the founder's laptop" |
| Tests | 0 | ≥60% on critical paths + CI gate | De-risks every future change |
| Compliance | None | SOC 2 Type II + DPAs/DPIA | Unlocks enterprise buyers entirely |
| Architecture | 7 God-files (Events.jsx 2,213 LOC) | Modular, typed | Removes key-person risk |
| Observability | console.log | Errors + uptime + tracing + SLA | Proves operational maturity |
| Docs | partial (added this session) | Full runbooks + architecture + onboarding | Shortens buyer's DD, raises confidence |

---

## 0b. Customer-Tier Unlock Map (maturity pillars + benchmarks)

A product is priced on the four pillars that surround it — see
[MATURITY_AUDIT.md](MATURITY_AUDIT.md) for the graded detail and
[BENCHMARKS.md](BENCHMARKS.md) for the numeric thresholds. Current grades:
**Provable trust C− · Graceful failure B− · Admin infra B · Operational maturity C.**
(We are already above amateur baseline on admin infra and failure handling — the
gaps cluster in *provable* trust and *live* ops.)

**What unblocks each revenue tier:**
| Tier | Already cleared | Blocked until we add |
|------|-----------------|----------------------|
| Individual / $20 | Works today | — |
| **Mid-market** | RBAC, audit logs, data export, idempotent payments | **live monitoring**, **public status page**, **SOC 2 Type I** |
| **Enterprise / $50k** | (the above) | **SSO/SAML**, **SOC 2 Type II**, **SLA + credits**, **tested DR**, **on-call** |

**Cheapest unlocks, highest ROI first** (4 of 5 are config/process, not code):
1. Turn on monitoring + error tracking — set `VITE_SENTRY_DSN` into the
   already-wired seam ([observability.js](../src/lib/observability.js)).
2. Public status page (Better Stack/Atlassian) → mid-market trust.
3. Run + **log one restore drill** → DR from paper to proof (DR-drill workflow nudges monthly).
4. SOC 2 Type I (Vanta/Drata) → mid-market procurement.
5. SSO/SAML (Supabase supports SAML/OAuth) → the enterprise door.

**Benchmark targets to hit** (audit against these): uptime **99.9%** min →
**99.99%** best-in-class; standards **ISO/IEC 27001, ISO 22301, ISO/IEC 20000-1,
ISO 9001, SOC 2 Type II, GDPR/PDPL**. These are folded into the phases below.

> New gaps these frameworks surfaced (now tracked in the phases): **SSO/SAML**,
> **public status page**, **live monitoring DSN**, **per-event export
> throttling** (pooled-tenancy cost guard, see [ADR-0001](adr/0001-tenancy-and-isolation.md)).

---

## 1. Target Architecture (the infrastructure centerpiece)

### Strategic decision: **consolidate the stack.**
The single biggest "institutional" upgrade is removing sprawl. Today you run
**four** runtimes (React, Express/Node, Python/Flask, Supabase functions/Deno)
with only two actually deployed. Target: **one language family (TypeScript)
and managed services only.**

```
                          ┌─────────────────────────────┐
        Users / Kiosks →  │  Cloudflare (WAF + CDN +      │
                          │  rate-limit + DDoS + bot mgmt)│
                          └───────────────┬─────────────┘
                                          │
                ┌─────────────────────────┼─────────────────────────┐
                ▼                         ▼                         ▼
        ┌───────────────┐        ┌──────────────────┐      ┌──────────────────┐
        │ Vercel        │        │ Supabase Edge     │      │ Container service │
        │ (React SPA/   │        │ Functions (Deno)  │      │ (Fly.io / Cloud   │
        │  PWA, static) │        │ - payments        │      │  Run / ECS):      │
        └───────────────┘        │ - webhooks        │      │ - partner verify  │
                                 │ - partner verify* │      │   API (if kept    │
                                 │ - medal parser*   │      │   in Node)        │
                                 └─────────┬─────────┘      └──────────────────┘
                                           ▼
                          ┌────────────────────────────────┐
                          │ Supabase Postgres               │
                          │ - RLS (hardened)                │
                          │ - PITR + daily backups          │
                          │ - Supavisor pooling             │
                          │ - SEPARATE dev/staging/prod     │
                          │ Storage: PRIVATE buckets +      │
                          │ signed URLs + lifecycle rules   │
                          └────────────────────────────────┘

  * Migrate Express `/api/v1/verify` and the Python Hy-Tek parser INTO Supabase
    Edge Functions (TypeScript). This deletes the Express server AND the Python
    runtime entirely — the cleanest institutional outcome. (Fallback: keep them
    as one containerized service if a rewrite is too risky near a sale.)
```

### Component-by-component plan

| Layer | Today | Target | Risk of change |
|-------|-------|--------|----------------|
| Frontend host | Vercel | Keep Vercel (behind Cloudflare) | LOW |
| Edge / serverless | 3 Supabase functions | + partner-verify + medal-parser migrated to TS edge fns | MED — parser needs parity tests vs Python output |
| Legacy API server | `server.js` (Express, undeployed) | **Retire** (move uploads already on Supabase Storage; verify→edge fn) | MED — re-point frontend `/api` calls |
| Python bridge | Flask on localhost | **Retire** (rewrite Hy-Tek parser in TS) or containerize on Cloud Run | MED-HIGH — regex parser parity |
| Database | 1 Supabase project (prod only) | 3 projects: dev / staging / prod; PITR on; pooling on | MED — env var plumbing, migration discipline |
| Storage | public bucket + `getPublicUrl` | private bucket + signed URLs + retention lifecycle | MED — update every image/doc render path |
| CDN / WAF | none (Vercel edge only) | Cloudflare: WAF, rate-limit, DDoS, bot, caching | LOW-MED — DNS cutover |
| Secrets | `.env` files + dotenv | Doppler / AWS Secrets Manager; injected at deploy | LOW |
| IaC | none | Terraform: Supabase + Vercel + Cloudflare + DNS providers | LOW (additive) |
| Observability | console.log | Sentry (errors) + Better Stack/Grafana (uptime, logs) + OTel tracing | LOW (additive) |
| CI/CD | GitHub Action (added) | full pipeline: lint+test+audit+typecheck+preview+migration-gate+blue-green | LOW-MED |
| DR | docs only | automated nightly backup verification + quarterly restore drill | LOW |

---

## 2. Phased Execution Plan

### Phase 0 — Stabilize & protect the IP (Weeks 0–2) · **highest priority**
Goal: stop the bleeding and make the asset legally clean.
| Task | Maps to DD | Risk |
|------|-----------|------|
| **[Day 1] Flip the storage bucket to PRIVATE + route file rendering through the signed-URL path** — ID/passport/medical docs are public *today*, protected only by unguessable filenames. **🟡 MIGRATION ACTIVE (2026-06-19, `feat/institutional`, staging-gated, flag default-off so behaviour is unchanged until cutover):** (1) `resolveFileUrl` now normalises a stored **path OR a legacy public URL** (`parseStorageRef` extracts bucket+path from Supabase public/sign URLs; external URLs pass through) — this makes the cutover a **flag-flip, not a live data backfill**; (2) render primitives built & tested — `useResolvedFileUrl` hook + `<StorageImage>` + `<StorageLink>` (public mode byte-identical/flicker-free, private mode = signed URL); (3) **3 render batches migrated** — participant-photo thumbnails (6 files), Reject-modal photo/ID/EID/medical doc links, Approve/Edit document-preview loops. **Remaining** = (a) finish the render-site sweep (card previews + html2canvas export, team logos, doc tabs, the `getThumbnailUrl` image-transform case, bulk download), (b) a **public edge function** that signs verification assets for the **anonymous `VerifyAccreditation`** page (decided: edge-fn, no public carve-out), (c) flip the bucket private + set `VITE_PRIVATE_STORAGE=true` + soak on **staging** (upload test files first). | #6, E07, E15 | **CRITICAL (live exposure)** — sweep + flag-on soaked on staging |
| **[Day 1] Wire monitoring: set `VITE_SENTRY_DSN` + `npm i @sentry/react`** into the existing seam (`src/lib/observability.js`) — turns "unmeasured" into a number; precondition for everything else | E11 | LOW |
| **[Day 1] Run + log ONE restore drill** (PITR/backup → throwaway project → smoke test); record the date in `docs/DR_RUNBOOK.md` | E09 | LOW |
| **[Day 1] Move the scanner PIN check server-side + rotate the PIN** — `VITE_SCANNER_PIN` is compiled into the public bundle (`Scanner.jsx:129`, `Events.jsx:571`, `:1333`) | E01, E05 | LOW-MED |
| **[Early] Biometric DPIA + pin the face-descriptor storage location + enforce the 30-day purge** — `docs/DATA_RETENTION.md` admits the store is currently "wherever face descriptors are stored" (undefined); Art. 9 / PDPL special-category data cannot wait for Phase 3 | E02, E15 | MED — legal review + a defined storage path |
| **Verify-first git history: ✅ VERIFIED (2026-06-19, [GIT_HISTORY_AUDIT.md](GIT_HISTORY_AUDIT.md))** — history DOES contain 90 PII photos + 4 ID docs + data dumps + `node_modules.zip` (72 MB) + a former `.env` (`VITE_SCANNER_PIN=1234`; **no** Supabase/Stripe secret). Remaining gated action: purge (`git filter-repo`), force-push, rotate the PIN | #1, #2 | **HIGH** — rewrites history; coordinate all clones, do once (runbook in the audit doc) |
| Move all secrets to a secrets manager; confirm `.env` never in history | E01 | LOW |
| Branch protection + required CI checks + CODEOWNERS | governance | LOW |
| Add README, CONTRIBUTING, LICENSE, IP-assignment/CLA | professionalism | LOW |
**Exit gate:** no public sensitive-doc URLs (bucket private + signed URLs live); error tracking on + one restore drill logged; scanner PIN no longer in the client bundle; biometric storage location defined with an enforced purge; git-history claim verified (and clean if it ever existed); CI required on `main`.

### Phase 1 — Infrastructure professionalization (Weeks 2–8) · **the core of this plan**
Goal: "it runs reproducibly, without anyone's laptop."
| Task | Maps to DD | Risk |
|------|-----------|------|
| Stand up **dev / staging / prod** Supabase projects | #5 | MED |
| Terraform everything (Supabase, Vercel, Cloudflare, DNS) | infra | LOW |
| Put Cloudflare in front (WAF + rate-limit + DDoS) | E05/E17 | LOW-MED |
| Migrate `/api/v1/verify` + medal parser to **TS edge functions**; retire `server.js` + Flask. **Re-implement rate limiting at the edge/WAF or a shared store** — the in-memory limiter in `server.js:37-63` is per-instance and does **not** survive serverless/multi-instance hosting | #5, E05 | MED-HIGH |
| ~~Convert storage to private buckets + signed URLs~~ (**bucket flip pulled to Phase 0**); here, add **lifecycle / retention rules** on the now-private bucket | #6 | MED |
| Enable PITR + Supavisor pooling; automated backup verification | E07/E09 | LOW |
| Wire uptime + structured logging + basic tracing (**Sentry DSN already turned on in Phase 0**) | E11 | LOW |
**Exit gate:** prod reproducible from Terraform; zero services on un-managed hosts; restore drill passed; error+uptime alerting live; **edge/WAF rate limiting active (no reliance on the retired in-memory limiter)**.

### Phase 2 — Code quality & test harness (Weeks 6–16, overlaps P1)
Goal: remove key-person risk; make change safe.
| Task | Maps to DD | Risk |
|------|-----------|------|
| Add ESLint + Prettier + `lint`/`test`/`typecheck` scripts; enforce in CI | professionalism | LOW |
| Introduce TypeScript **incrementally** (`allowJs`, type the data layer first) | #8 | MED |
| Test harness (Vitest + Playwright); cover auth, payments, scanning, RLS | #3 | LOW to add |
| Decompose the 7 God-files **after** tests exist (Events.jsx → feature modules) | #4 | MED-HIGH — do test-first |
| Bundle diet: lazy-load face-api/TensorFlow; split the 868 KB QR chunk — **✅ DONE (2026-06-19):** QR route chunk **877 KB → 7 KB** (lazy tab panels + lazy face-api), recharts off the Dashboard critical path, export libs (jspdf/html2canvas/xlsx) load only on export | E16 | LOW-MED |
**Exit gate:** ≥60% coverage on critical paths; no file >800 LOC on the hot paths; green typecheck on the data layer.

### Phase 3 — Compliance & commercial readiness (Weeks 12–24)
Goal: unlock enterprise buyers and justify the multiple.
Score against the concrete thresholds in [BENCHMARKS.md](BENCHMARKS.md). Audit
against these standards: **ISO/IEC 27001** (security — pursue first), **ISO 22301**
(business continuity/DR), **ISO/IEC 20000-1** (incident/SLA mgmt), **ISO 9001**
(release quality), plus **SOC 2 Type II** and **GDPR/PDPL**.

| Task | Maps to DD | Risk |
|------|-----------|------|
| **SOC 2 Type I → Type II** (Vanta/Drata to automate evidence) | E02 | LOW (process) |
| **SSO / SAML** login (Supabase SAML/OAuth) — the enterprise door | Maturity P3 | MED |
| Per-event/per-user **export throttling** (pooled-tenancy cost-runaway guard) | ADR-0001 | LOW-MED |
| DPAs, sub-processor list, DPIA for biometrics, data-residency stance | E02/E15 | LOW |
| Public status page + documented SLA + on-call runbooks | E11 | LOW |
| Admin/operator docs, API docs hosted, onboarding guide | E12 | LOW |
| Pen-test by a third party; publish summary | E05 | LOW |
**Exit gate:** SOC 2 Type II report (or in-progress with Type I done); signed DPAs; external pen-test passed.

### Phase 4 — Scale & polish (ongoing)
Multi-region read replicas, cost optimization, accessibility (WCAG 2.1 AA),
performance budgets, analytics/funnel instrumentation for the growth story.

---

## 3. Workstream Detail (every aspect, condensed)

- **Infrastructure** — see §1/§2. North star: one TS stack, fully IaC, 3 envs, Cloudflare-fronted, observable, DR-tested.
- **Security** — already hardened this session (RLS, hashed keys, rate-limit, server-side pricing). Add: WAF, secrets manager, periodic pen-tests, dependency-audit CI gate (done), private storage.
- **Compliance/Legal** — SOC 2 Type II, GDPR/PDPL DPAs, DPIA for face data, retention automation (cron purge per `DATA_RETENTION.md`), IP assignment.
- **Data/DB** — env separation, PITR, pooling, migration discipline (rename/clean the `_diag_` history going forward, no renumber of applied ones), seed/fixtures for staging.
- **Architecture/Code** — TS, ESLint/Prettier, decompose God-files, shared component library, remove Python.
- **Testing/QA** — Vitest (unit) + Playwright (e2e) + RLS policy tests + visual regression on badge/PDF exports (the jsPDF upgrade makes this essential).
- **DevOps/CI-CD** — full pipeline, preview environments per PR, migration gate, blue-green/canary deploys, automated rollback.
- **Observability/SRE** — Sentry, uptime, structured logs, OTel traces, SLOs, alerting, incident runbooks, MTTR tracking.
- **Product/UX** — onboarding flow, empty states, accessibility, analytics/funnel instrumentation (also feeds the valuation story).
- **Documentation** — README, ARCHITECTURE (done), SECURITY (done), DR/RETENTION/PRIVACY (done), runbooks, API docs, ADRs (architecture decision records).
- **Doc reconciliation (standing checkpoint)** — keep the docs honest against the code each cycle. A *stale* security/dependency doc is worse than none in due diligence: it reads as careless or misleading. Specifically keep `SECURITY.md`'s `server.js` framing aligned with its deployment status, and `dependency-risk.md` aligned with `package.json` versions.
- **Team/Process** — branch protection, code review, CODEOWNERS, release process, key-person redundancy (document the God-files' logic before refactor).

---

## 4. Cost, effort & team

| | Estimate |
|---|---|
| Duration to "sale-ready" | ~6 months focused (Phases 0–3) |
| Team | 2–3 senior engineers + part-time DevOps/SRE + a compliance lead (or Vanta/Drata + auditor) |
| External spend | SOC 2 audit + pen-test + compliance tooling: ~$25–60K; infra ~$300–1,500/mo at this scale |
| Sequencing rule | Phase 0 before anything public; tests (P2) before God-file refactor; SOC 2 (P3) can run in parallel from week ~6 |

---

## 5. Sale-Readiness Checklist (what a $500K+ buyer will tick)
- [ ] Clean git history — no PII, no secrets, no binaries
- [ ] IP fully assigned; licenses compliant; SBOM available
- [ ] Reproducible infra (Terraform) across dev/staging/prod
- [ ] No service runs outside managed hosting
- [ ] ≥60% test coverage on critical paths + green CI
- [ ] SOC 2 Type II (or Type I + Type II in progress)
- [ ] Signed DPAs, DPIA for biometrics, data-residency answer
- [ ] Error tracking + uptime + documented SLA + runbooks
- [ ] No file >800 LOC on hot paths; TS on the data layer
- [ ] Third-party pen-test passed
- [ ] Documented metrics: ARR, churn, CAC, active events/users

---

## 6. Risk register for the transformation itself
| Change | Risk | Mitigation |
|--------|------|-----------|
| Git history rewrite (P0) | Breaks all clones/PRs; possible already-scraped PII | Freeze repo, coordinate, do once, rotate secrets |
| Retire Express/Python (P1) | Partner API / medal parsing regress | Parity tests vs current output before cutover; keep old path until verified |
| Private storage migration (**P0 — pulled forward**) | Images/docs stop rendering | Signed-URL helper + full render-path sweep + staging soak |
| God-file decomposition (P2) | Behavioral regressions | Tests first; refactor in small PRs behind preview envs |
| TS migration (P2) | Churn, slowdowns | Incremental `allowJs`; type data layer first; never big-bang |
| Env separation (P1) | Migration/secret drift | Terraform + migration gate in CI; staging mirrors prod |

---

_Owner: ___  ·  Target close-readiness date: ___  ·  Review cadence: biweekly
(each review includes a **doc-reconciliation checkpoint**: re-confirm `SECURITY.md`
and `dependency-risk.md` against the live deployment status and `package.json`)._
