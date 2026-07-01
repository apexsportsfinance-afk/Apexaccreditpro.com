# White-Label Checklist — every "Apex" spot in the real app

Goal: when an org uses its own custom domain, a federation/club/participant sees
**zero "Apex"** — only their own brand. Each item below is a hardcoded spot today
that must read from the org's record (`organizations.name / logo_url / brand_primary
/ custom_domain / email config`) instead.

Mechanism: a `BrandingContext` that resolves the org by hostname on load and feeds
name/logo/colours everywhere; email edge functions take `org_id` and look up the
org's sender + templates. (Org table + isolation already built & proven.)

Legend: [ ] = to do · 🔴 participant-facing (highest priority) · 🟠 admin-facing · 🟢 system/app

---

## A. Core brand identity (logo, name, title, favicon)
- [ ] 🔴 Browser tab title — `index.html:6` ("ApexAccreditation")
- [ ] 🟠 Sidebar logo + alt text — `src/components/layout/Sidebar.jsx:78,79,86,87` (`/apex-logo.png`, "Apex Sports Academy")
- [ ] 🟢 Logo asset files — `public/apex-logo.png`, `public/icon.png`, favicon → per-org upload
- [ ] 🟠 Staff layout title — `src/components/layout/StaffLayout.jsx:24` ("Apex Staff")
- [ ] 🟠 Platform label — `src/pages/admin/settings/SystemInfoTab.jsx:22` ("ApexAccreditation v1.0")
- [ ] 🟠 Team portal title — `src/pages/admin/Teams/TeamsDashboard.jsx:190` ("Apex Team Portal")
- [ ] 🟠 Dashboard heading — `src/pages/admin/Dashboard.jsx:599` ("Apex Sports Global Intelligence")

## B. Participant-facing public pages (🔴 most important)
- [ ] 🔴 Public homepage — `src/pages/public/Home.jsx:69,126,306` ("ApexAccreditation", "Apex Professional")
- [ ] 🔴 Registration page — `src/pages/public/Register.jsx:1475` ("Apex Sports")
- [ ] 🔴 Accreditation verify page footer — `src/pages/public/VerifyAccreditation.jsx:2034` ("Apex Sports Accreditation System")
- [ ] 🔴 Feedback form — `src/pages/public/FeedbackForm.jsx:435` ("ApexAccreditation Dynamic Event System")
- [ ] 🔴 Call-room display fallback — `src/pages/display/CallRoomDisplay.jsx:210` ("Apex Call Room Display")
- [ ] 🔴 Terms text — `src/components/TermsModal.jsx:101` + `src/pages/admin/events/TermsView.jsx:76` ("Apex Sports events" / default Apex terms)

## C. Emails (🔴 — sender name, signature, templates)
- [ ] 🔴 Email "From" name — `supabase/functions/send-accreditation-email/index.ts:33` (default "Apex Sports Accreditations") → per-org
- [ ] 🔴 Email body templates — same file lines 214,236,252,261,265
- [ ] 🔴 Email signature — `src/lib/email.js:378` ("The Apex Sports Team")
- [ ] 🔴 Compose-email default body — `src/components/accreditation/ComposeEmailModal.jsx:62,65` ("Apex Sports Accreditations")
- [ ] 🔴 Birthday message — `src/components/accreditation/BirthdayBroadcastPage.jsx:74` ("from the Apex Sports Team")
- [ ] 🔴 Default sender config + reject/templates — `src/pages/admin/Settings.jsx:86,92,274,278,282,571` (`accreditations@apexsports.ae`)
- [ ] 🟠 Box-office fallback email — `src/components/admin/BoxOfficeTab.jsx:149,181` ("no-reply@apex-sports.local")
- [ ] 🟢 Email domain authentication (SPF/DKIM) per org — so mail appears fully from the client's domain (premium setup)

## D. Badges, passes, watermarks, exports (🔴 printed/shared artifacts)
- [ ] 🔴 Fixture PNG watermark — `src/components/accreditation/FixturePNGCard.jsx:221` ("Apex Sports Academy")
- [ ] 🟠 Ticketing export filename — `src/pages/admin/Ticketing.jsx:239` ("ApexTicketing_...")
- [ ] 🟠 Partner API PDF guide — `src/pages/admin/APIDocs.jsx:32,43,459` ("Apex Partner API", "© 2026 Apex Sports Academy", technical@apexsports.com)

## E. App / PWA / offline
- [ ] 🟢 PWA manifest name — `public/manifest.json:2,3` + `vite.config.js:15,17,18` ("Apex Unified Scanner")
- [ ] 🔴 Offline page — `public/offline.html:6,197` ("Apex Sports Academy")

## F. Minor / placeholders
- [ ] 🟢 Settings placeholder example — `src/pages/admin/Events.jsx:1379` ("info@apex.com" — just placeholder text)
- [ ] 🟠 API docs marketing copy — `src/pages/admin/APIDocs.jsx:173,216,239` ("Apex Platform")

---

## NO CHANGE NEEDED (internal code names — invisible to all users)
- `apex-glass` CSS class — Card.jsx, StatsCard.jsx, BroadcastHistory.jsx
- `apex:` animation easing — tailwind.config.js:81
- `ApexOfflineDB` IndexedDB name — offlineDb.js:1
- Code comments — LiveScoresWidget.jsx:3,5
- `apex-staging-2ft.pages.dev` CORS allowlist — verify-scanner-pin / public-verify-assets (config, will be replaced by real domains)

---

## Summary
- 🔴 Participant-facing items: ~18 (do first — these are what clients/participants see)
- 🟠 Admin-facing: ~8 (Apex/org staff only — lower urgency)
- 🟢 System/app: ~5
- Internal (no change): 5

None are hard individually — it's a systematic sweep once the `BrandingContext`
exists. The work is *finding and rewiring each one*, which this list now makes
fully visible.
