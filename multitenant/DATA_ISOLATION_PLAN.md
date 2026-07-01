# Data-Isolation Deployment Plan (production)

_Draft for review — nothing applied to live until approved. 2026-06-29_

Goal: let a federation/club log in and manage **their own** events, registrations,
accreditations, cards — fully isolated from every other client — while Apex (you)
sees everything. This is the layer that turns "their brand" into "their own system".

---

## 1. The design (why it's small and safe)

**Anchor on `events`.** Only ONE table gets a new column: `events.org_id`. Every
event-scoped child table (accreditations, teams, scan logs, orders, photos, …)
inherits its org through its existing `event_id` — no column added, no mass backfill.

**Isolation = one RESTRICTIVE policy per table.** A restrictive RLS policy is
AND-ed with the existing policies, so it can **only narrow** access, never widen.
That means we do **NOT rewrite** the ~40 existing security policies — we add a thin
layer on top:
- `events`: visible/writable only if `org_id` ∈ your org(s) — or you're Apex master
- child tables: only if their `event_id` belongs to an event you may reach

**Apex master bypasses everything.** `is_platform_admin()` (your `super_admin`
role) sees all orgs, always.

**Public pages are untouched.** The policy applies only to the `authenticated`
role. Anonymous visitors (public registration, verify, tickets) are governed by the
existing anon policies — unchanged. So nothing public breaks.

This exact pattern passed the isolation proof in the sandbox (Org A and Org B each
saw only their own events/accreditations/scan logs; Apex saw all).

---

## 2. The make-or-break safety step: preserve current access

Today every event has no `org_id`. If we switch on isolation without backfilling,
your **non-super-admin staff would be locked out** of all events (the policy would
match nothing for them). So BEFORE enabling isolation:

1. Create a default **"Apex" organisation**.
2. Set `org_id = Apex` on **all existing events**.
3. Add **all current staff/admin users** as members of the Apex org.

Result: your team keeps seeing exactly what they see today; new client orgs are
separate. Super-admins are unaffected regardless (they bypass isolation).

---

## 3. New events must auto-stamp `org_id`

When a client admin creates an event, it must be tagged with their org — otherwise
it lands with `org_id = NULL` and becomes invisible to them. Cleanest fix: a
**BEFORE INSERT trigger** on `events` that sets `org_id` from the creating user's
org membership when they're not super-admin. (No app change required; works for
every insert path.) Apex master inserts can pass an explicit `org_id`.

---

## 4. Deployment sequence (staging first, then live)

**Phase 0 — Enumerate.** Read-only query: list every `public` table and whether it
has `event_id`. This produces the exact list of tables to isolate (and confirms
which are global/platform tables that must NOT be isolated).

**Phase 1 — Foundation (additive).** Deploy the rest of `001`: `organization_members`
+ helpers `is_platform_admin / current_user_org_ids / is_org_admin / is_org_member`.
(Live already has `organizations` + `get_org_branding` from the branding deploy.)

**Phase 2 — Backfill (preserve access).** Create Apex org; `events.org_id` column;
set all existing events → Apex org; add all current users → Apex org members.

**Phase 3 — Enable isolation.** `my_event_ids()`, `apply_tenant_isolation()`, the
`events` policy, then loop the helper over every event-scoped table from Phase 0.
Add the `events` BEFORE INSERT trigger.

**Phase 4 — Verify (on STAGING).** Run the app:
- super-admin → sees all (unchanged)
- a normal staff user → sees all current (Apex-org) data (unchanged)
- a test client org + user → sees ONLY their own event; staff don't see it
- public registration / verify pages → still work
- create an event as the client user → it auto-tags to their org and they see it

**Phase 5 — Promote to live.** Same SQL, same order, via the Supabase web editor on
`dixelomafeobabahqeqg`. Re-run the same verifications on live.

---

## 5. App / provisioning follow-ons (after isolation is live)

- **Client user provisioning:** create their Supabase Auth user + an
  `organization_members` row (org + role `org_admin`). Initially a short SQL step;
  later a small admin screen.
- **Feature gating per package:** the `organizations.features` / `plan` already
  exist; the app can later show/hide modules per the org's package.

---

## 6. Risk & rollback

- **Risk:** RLS mistakes can over- or under-expose data. Mitigated by: restrictive
  (narrow-only) policies, the sandbox proof, staging-first, and the backfill that
  preserves current access. Public/anon paths are out of scope of the policy.
- **Rollback:** drop the `tenant_isolation` policies → instantly back to today's
  behavior. The `org_id` column and helper tables are harmless and can stay.

---

## 7. What I need from you to proceed

1. Approve this approach.
2. Confirm we do **staging first** (`bieqfzwljxkmmldmlzyb`), verify, then live.
3. I'll then write the exact, reviewable SQL for each phase — you run it in the
   web editor and paste results, same as the branding deploy. Nothing touches live
   until staging is green and you say go.
