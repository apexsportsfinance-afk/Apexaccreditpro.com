# Staging on Cloudflare Pages — Isolated, Cannot Touch Live

Goal: a real, shareable test environment that is **provably isolated** from the
live deployment. The golden rule: **nothing you test here may point at the live
Supabase project or the live Stripe account or the production domain.**

> The host (Cloudflare Pages) is separate from Vercel automatically. What makes
> this *safe for your data* is that its **environment variables point at a
> separate Supabase project + Stripe test mode** — never the live keys. The host
> is isolated; the backend is only isolated if you make it so.

---

## The isolation contract (read first)

| Resource | LIVE (never touch for testing) | STAGING (use this) |
|----------|-------------------------------|--------------------|
| Frontend host | Vercel | **Cloudflare Pages** (`*.pages.dev`) |
| Supabase project | `dixelomafeobabahqeqg.supabase.co` | a **new** `apex-staging` project |
| Stripe | live keys | **test-mode** keys |
| Domain | `accreditation.apexsports.ae` | the `*.pages.dev` URL only |

If any staging env var equals a value in the LIVE column, **stop** — it is not
isolated.

**Built-in safety net:** `src/lib/supabase.js` throws if `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` are missing — there is **no baked-in live fallback**. So
a misconfigured build fails loudly instead of silently using live. The only way
to hit live is to *consciously paste live keys* — which this runbook tells you not
to do.

---

## Step 1 — Create the staging Supabase project (you, in Supabase dashboard)
1. New project → name `apex-staging` (free tier is fine). Note its **Project URL**
   and **anon key** (Settings → API). These are your staging keys.
2. Apply the schema. **Read [`supabase/STAGING_SCHEMA.md`](../supabase/STAGING_SCHEMA.md) first** —
   the migrations only contain *feature* tables; the **base** tables (`events`,
   `accreditations`, `teams`, …) were created in the live dashboard, so `db push`
   alone leaves a fresh project incomplete. Dump live schema (structure only, no
   data) and apply it, then push migrations on top:
   ```bash
   supabase db dump --linked --schema public -f supabase/schema.live.sql  # structure only
   supabase link --project-ref <STAGING_PROJECT_REF>   # the staging ref, NOT live
   psql "<STAGING_DB_URL>" -f supabase/schema.live.sql # base schema
   supabase db push                                    # applies supabase/migrations/ on top
   ```
3. Seed **fake** data only (no real athlete PII). A handful of test events /
   accreditations is enough.
4. Auth → URL Configuration → add your future `https://<project>.pages.dev` to
   **Site URL** and **Redirect URLs** (so login works on the staging origin).
5. Storage → create the same buckets the app uses (e.g. `accreditation-files`).
6. (Only if testing payments) deploy the edge functions to the **staging** project
   and set **Stripe TEST** secrets:
   ```bash
   supabase functions deploy create-payment-session verify-session stripe-webhook
   supabase secrets set STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_test_...
   ```
   Point a **test-mode** Stripe webhook at the staging function URL.

## Step 2 — Create the Cloudflare Pages project (you, in Cloudflare dashboard)
1. Pages → Create → **Connect to Git** → select the repo, **branch = `staging`**
   (create that branch; do not build from `main`). *Or* use **Direct Upload** of a
   locally-built `dist/` (see note).
2. Build settings:
   - **Framework preset:** Vite (or None)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
3. **Environment variables** (set for Production *and* Preview) — **STAGING values only**:
   ```
   VITE_SUPABASE_URL=https://<STAGING_REF>.supabase.co
   VITE_SUPABASE_ANON_KEY=<STAGING anon key>
   VITE_SCANNER_PIN=<any test PIN>
   NODE_VERSION=20
   ```
4. Deploy. You get `https://<project>.pages.dev`. **Do not** add the
   `apexsports.ae` domain.

> **Direct-upload note:** if you drag-drop a local `dist/`, you must build it with
> staging env first (e.g. a `.env.staging` with the staging keys), because Vite
> **bakes the keys into the bundle at build time**. Building with your current
> `.env` (live) and uploading = a live client. Prefer the Git+branch route so
> Cloudflare builds with the staging env vars above.

## Step 3 — PRE-FLIGHT ISOLATION CHECK (do this BEFORE any testing)
Prove the staging site is not wired to live **before** you click anything that
writes data:
1. Open `https://<project>.pages.dev` → DevTools → **Network** tab.
2. Trigger a data load (e.g. open the login or a public event page).
3. Confirm every Supabase request goes to **`<STAGING_REF>.supabase.co`** and
   **NOT** `dixelomafeobabahqeqg.supabase.co`.
   - Quick alternative: DevTools → Sources/search the bundle for `supabase.co` and
     confirm only the staging ref appears.
4. If testing payments: confirm Stripe is in **test mode** (card `4242 4242 4242
   4242` works; no real charge).
5. ✅ Only when the URL is the staging ref do you start testing. ❌ If you see the
   live ref anywhere, stop and fix the env vars.

---

## What won't work on staging (expected, not a bug)
- `server.js` (Express uploads / `/api/v1/verify`) and the Python medal parser do
  **not** run on Cloudflare Pages (static + functions only — same constraint as
  Vercel). Those features are exercised only once migrated to edge functions.
- Security headers/CSP in `vercel.json` are **Vercel-only** and won't apply on
  Pages. For testing that's harmless (absent CSP is only more permissive). To
  mirror them, add a Cloudflare Pages `_headers` file later — not required to test.

## Never-do list (keeps live safe)
- ❌ Never put a live Supabase URL/anon key or live Stripe key in the Cloudflare env.
- ❌ Never assign `accreditation.apexsports.ae` (or any live DNS) to the Pages project.
- ❌ Never build the staging site from the `main` branch with live env.
- ❌ Never run `supabase link`/`db push`/`functions deploy` against the **live**
  project ref while doing staging work.

## When you're done & verified
Promotion to live is a **separate, deliberate** step you trigger (merge `staging`
→ `main`, apply migrations to the live project, etc.) per
[DEPLOYMENT.md](DEPLOYMENT.md). Nothing in this runbook changes live on its own.
