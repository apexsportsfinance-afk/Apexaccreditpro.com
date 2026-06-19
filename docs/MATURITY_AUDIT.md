# Maturity Audit — the four pillars that separate a toy from an enterprise contract

The reframe: an amateur product optimizes for the **demo** ("does it work?"); a
professional product optimizes for the **3am incident** ("what happens when it
doesn't, who finds out first, how fast do we recover, and can I prove we handled
it correctly?"). Most of the price lives in that second question.

Almost none of this requires rebuilding the product — it's a trust layer, a
failure layer, an admin layer, and an ops layer added *around* what exists.

Grades are honest current state, with evidence.

---

## Pillar 1 — Provable trust (not claimed trust) · Grade: **C−**
Enterprise buyers can't purchase what their security team can't sign off on.
| Have | Lack |
|------|------|
| Hardened, documented controls (RLS, hashed keys, server-side pricing) — [SECURITY.md](SECURITY.md) | **SOC 2 report** (roadmap) |
| Privacy + retention docs ([PRIVACY.md](PRIVACY.md), [DATA_RETENTION.md](DATA_RETENTION.md)) | **Public status page** with real uptime history |
| Dependency security gate in CI | **SLA with teeth** (credits when we miss) |
|  | **Measured uptime** at all (no monitoring yet) |
**Verdict:** controls are real; *proof* is missing. Trust is not yet auditable.

## Pillar 2 — Failure handled, not avoided · Grade: **B−**
| Have | Lack |
|------|------|
| `ErrorBoundary` so users never see a raw stack trace | Region **failover** (single Supabase project) |
| Retry + network-error handling ([apiHelpers.js](../src/lib/apiHelpers.js)) | **Tested** backups (drill not yet run) |
| **Idempotent** Stripe webhooks + 400-on-failure so Stripe retries (no silent payment loss) | Live alerting on failures (seam only) |
| Offline DB + sync service; graceful degradation | Load-shedding under DB pressure |
**Verdict:** **app-level** failure handling is a genuine relative strength;
**infra-level** (failover, tested restore, alerting) is weak. This is the one
pillar where we're already above amateur baseline.

## Pillar 3 — Boring admin infrastructure · Grade: **B**
The unglamorous layer that makes a product *administrable by an org*, not just
*usable by a person* — and most of the $20→$50k jump is paid for this.
| Have | Lack |
|------|------|
| **RBAC** — roles + permissions ([permissions.js](../src/lib/permissions.js), tested) + RLS enforcement | **SSO / SAML** (email-password only) — a hard enterprise blocker |
| **Audit logs** — `AuditAPI.log` used across 8 API modules; admin audit views | Formal **API deprecation/versioning policy** (have `/api/v1/`, no policy) |
| **Data export** (export modals, bulk ops) | SCIM / directory-sync user provisioning |
| Module-level access control; partner API (`/api/v1/`) with scoped keys | Fine-grained custom roles |
**Verdict:** surprisingly strong — RBAC, audit logs, data export, and API
versioning already exist. **SSO is the headline gap** for enterprise.

## Pillar 4 — Operational maturity · Grade: **C**
| Have | Lack |
|------|------|
| CI pipeline with hard gates (audit/test/build) | **Live monitoring/alerting** (seam wired, no DSN) |
| Rollback (Vercel instant + stale-chunk auto-reload) | Real **on-call** rotation |
| Incident response + DR runbooks ([DR_RUNBOOK.md](DR_RUNBOOK.md)) | **Tested** restorable backups (an untested backup is a hope) |
| `/healthz`; monthly DR-drill workflow | Status page / public incident comms |
**Verdict:** documented and scaffolded; not yet **live and proven**.

---

## Which gap blocks which customer tier
| Tier | Already cleared | Still blocked by |
|------|-----------------|------------------|
| **Individual / $20-tier** | Works today ✅ | — |
| **Mid-market** | RBAC, audit logs, data export, idempotent payments | Live **monitoring** + **status page** + **SOC 2 (Type I)** |
| **Enterprise / $50k-tier** | (the above) | **SSO/SAML**, **SOC 2 Type II**, **SLA + credits**, **tested DR**, **on-call** |

## Cheapest unlocks (highest ROI first)
1. **Turn on monitoring + error tracking** (Sentry DSN into the existing seam) →
   converts "unmeasured" to a number; precondition for everything else.
2. **Public status page** (e.g. Better Stack) → opens mid-market trust conversations.
3. **Run + log one restore drill** → turns DR from paper into proof.
4. **SOC 2 Type I** (Vanta/Drata) → opens mid-market procurement.
5. **SSO/SAML** (Supabase supports SAML/OAuth providers) → the enterprise door.

See [BENCHMARKS.md](BENCHMARKS.md) for the numeric thresholds and
[INSTITUTIONAL_ROADMAP.md](INSTITUTIONAL_ROADMAP.md) for sequencing.
