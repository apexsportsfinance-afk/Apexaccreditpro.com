# White-Label — Implementation Status

_Last updated: 2026-06-29_

Companion to `WHITE_LABEL_CHECKLIST.md` (the original spot-by-spot inventory).
This file records **what is built, what is deferred, and the exact steps to go
live**. Nothing here is deployed yet — all code changes are local and
build-verified; the live database and edge functions are untouched.

---

## 1. How it works (the mechanism)

**`src/contexts/BrandingContext.jsx`** — the foundation. On load it resolves the
current organisation **from the hostname** and exposes its name / logo / colours
/ tagline through a `useBranding()` hook (and a `getActiveBranding()` singleton
for non-React code like the email library).

Resolution order (first match wins): `?org=<slug>` query param → full hostname →
first sub-domain label. It calls the **public, read-only** RPC
`get_org_branding(p_key)`.

**Non-breaking by construction:** it starts on the Apex default and only swaps to
a tenant brand if an org actually resolves. On the live DB today the RPC does not
exist → the call is caught → the Apex default stays. So every current user sees
exactly what they see now. Each wiring site also uses
`branding.isApex ? "<original literal>" : branding.<field>`, so existing output
is byte-for-byte identical until a real tenant is mapped.

Mounted in `src/App.jsx` as the outermost provider (above the router), so it
resolves once per full page-load and persists across in-app navigation.

---

## 2. What is DONE (build-verified, not deployed)

| Area | Spots | Files |
| --- | --- | --- |
| Foundation | provider + hook + singleton | `contexts/BrandingContext.jsx`, `App.jsx` |
| A — Core identity | sidebar logo/name, tab title, staff layout, platform label, team-portal heading, dashboard heading | `Sidebar.jsx`, `StaffLayout.jsx`, `SystemInfoTab.jsx`, `TeamsDashboard.jsx`, `Dashboard.jsx` |
| B — Participant-facing | home (header/hero/footer + powered-by), registration, verify footer, feedback, call-room, terms (modal + admin note) | `public/Home.jsx`, `public/Register.jsx`, `public/VerifyAccreditation.jsx`, `public/FeedbackForm.jsx`, `display/CallRoomDisplay.jsx`, `TermsModal.jsx`, `events/TermsView.jsx` |
| C — Emails (Layer 1) | sender display name, footers, custom header, signature, compose + birthday defaults | `lib/email.js`, `functions/send-accreditation-email/index.ts`, `ComposeEmailModal.jsx`, `BirthdayBroadcastPage.jsx` |
| D — Badges / exports | fixture PNG watermark, ticketing export filename | `FixturePNGCard.jsx`, `Ticketing.jsx` |
| E — PWA / offline | scanner manifest + vite PWA name + offline page → **neutral** (owner decision) | `public/manifest.json`, `vite.config.js`, `public/offline.html` |
| Extra (found in preview) | login-page brand; sidebar text-fallback for logo-less orgs | `public/Login.jsx`, `Sidebar.jsx` |

Preview verified on localhost against the sandbox: `?org=demofc` → blue "Demo FC"
sidebar text; `?org=UAEAF` → real uploaded crest logo; no param → unchanged Apex.

---

## 3. What is DEFERRED (and why)

- **Emails — Layer 2 (per-org sending domain + SPF/DKIM).** Owner chose Layer 1
  (display name + templates) for now. The from-_address_ still uses Apex's
  verified mailbox; the SMTP `EHLO`/`Message-ID` domain stays `apexsports.ae`.
  True "zero Apex even in the address" needs per-domain DNS verification (likely
  a provider such as Resend/SendGrid) — a separate infrastructure project.
- **`APIDocs.jsx` (Partner API docs).** The Partner API is parked as a
  platform-level (Apex-owned) service, so its docs legitimately stay
  Apex-branded until that business decision flips.
- **Minor (Section F):** `email.js` ticket link `accreditation.apexsports.ae`
  (Layer-2 domain concern), `Settings.jsx` global SMTP config UI (platform
  level), `BoxOfficeTab.jsx` `no-reply@apex-sports.local` fallback,
  `Events.jsx` `info@apex.com` placeholder text.
- **Per-org PWA branding.** Static manifest/offline files are shared by one
  deployment, so they were made neutral rather than per-org. A true per-org PWA
  would need a dynamic per-host manifest endpoint.

---

## 4. Go-live sequence

The frontend is safe to ship at any time (it shows Apex until activated). To
actually turn white-label ON:

1. **Deploy the multi-tenant DB pieces to the LIVE database** — the
   `organizations` table, branding columns, and the `get_org_branding` /
   `admin_*` functions (the `001`/`005`/`006`/`007`/`008` SQL, adapted), plus
   `org_id` on `events`. Until this exists, branding resolves to Apex for
   everyone (the safe default).
2. **Deploy the email edge function:**
   `supabase functions deploy send-accreditation-email` — so per-org sender
   names take effect. (Backward compatible: absent `brandName` ⇒ "Apex".)
3. **Ship the frontend build** (normal deploy path).
4. **Provision a client:** create their org row + branding (via the Master
   Console), then map their custom domain to it. Their domain now renders fully
   in their brand, zero Apex.

---

## 5. Known limitations / notes

- Logo images uploaded via the Master Console are stored inline as data URLs
  (demo). Production should move to Supabase Storage + public URL.
- The Master Console admin RPCs are granted to `anon` in the **sandbox** for the
  demo. Production must gate them behind `is_platform_admin()`.
- Org resolution is by hostname; `?org=<slug>` is a convenience override for
  previews/demos.
