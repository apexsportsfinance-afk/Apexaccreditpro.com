# ADR 0001 — Tenancy model & data isolation

- **Status:** Accepted
- **Date:** 2026-06-19
- **Deciders:** Platform owner + engineering

## Context
ApexAccreditPro serves many events/organizers ("tenants") from a single
Supabase (Postgres) + Vercel + Stripe stack. A common piece of external advice
is an AWS reference architecture (ECS + RDS/DynamoDB + Lambda + per-tenant STS/
IAM policies) and a choice between **pooled** (shared infra, app/DB-layer
isolation) and **siloed** (dedicated infra per tenant) tenancy.

The recognized guidance: for early-stage / SMB-focused / price-sensitive
products, use **pooled tenancy with enforced logical isolation**, and break out
siloed infrastructure later only for enterprise customers who demand it. The
critical requirement is that isolation is enforced **at the data layer**, not by
an application-level `WHERE tenant_id = ?` clause that can't survive a compliance
audit.

## Decision
1. **Stay pooled** — one Supabase Postgres, shared across events, with isolation
   enforced by **Row-Level Security (RLS)**. This matches the recommended pooled-
   with-logical-isolation pattern. Supabase RLS is our equivalent of the
   "Aurora row-level security" mechanism in the AWS pattern.
2. **Do NOT migrate to AWS ECS/RDS/DynamoDB/Lambda now.** It would abandon our
   managed stack, re-introduce operational sprawl we are actively removing
   (see [EDGE_MIGRATION.md](../EDGE_MIGRATION.md)), require a multi-month rewrite
   that risks the core product, and solve a problem we do not have at this stage.
   The external AWS tooling is a reference pattern, not a prescription; our stack
   is chosen for our team's skills and our budget.
3. **Enforce isolation at the DB layer, already done:** RLS hardened so admin
   authority comes from server-controlled `profiles.role` (not self-editable JWT
   metadata), partner API keys hashed, payments use server-side price authority.
4. **Future siloing path (deferred):** an enterprise customer demanding physical
   isolation gets a **dedicated Supabase project** provisioned via the Terraform
   modules — not a bespoke AWS build.

## Consequences
- ✅ Lowest cost/complexity for our stage; one stack to operate and certify.
- ✅ Compliance answer to "prove Tenant A can't read Tenant B" is **RLS policies +
  tests**, not a `WHERE` clause.
- ⚠️ **Noisy-neighbor / cost-runaway risk** is real in a pooled model: a single
  event running a bulk export can consume shared DB capacity. **Mitigation
  required** — per-event/per-user throttling on bulk export/report endpoints
  (tracked; see roadmap). Network rate-limiting (Cloudflare module) is the first
  layer; app-level export quotas are the second.
- ⚠️ Blast radius is shared — a bad migration/incident affects all events. Hence
  the dev/staging/prod separation and migration gate in the roadmap.

## Revisit when
- An enterprise contract requires contractual physical isolation, **or**
- Pooled DB load/cost from the largest events degrades others despite throttling.
