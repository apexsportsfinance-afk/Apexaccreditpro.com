# 🗺️ Architecture Map — How to Browse This App

This is your **front door** to the codebase. Everything is grouped into three
layers. Read top-to-bottom and you understand the whole system.

> Mental model: **ENTRY** receives a request → **INTERFACE** shows the screen →
> **DATA** does the work and talks to the database.

```
        ┌───────────────────────────────────────────────────────┐
        │  ENTRY        a user opens a page / a request arrives   │
        │     │         src/pages, server.js, supabase/functions  │
        │     ▼                                                   │
        │  INTERFACE    the screen they see + reusable widgets     │
        │     │         src/components, src/contexts               │
        │     ▼                                                   │
        │  DATA         fetch / save / validate / talk to DB       │
        │               src/lib, src/services, supabase/migrations │
        └───────────────────────────────────────────────────────┘
```

---

## 1️⃣ ENTRY — where things start

The points where a human or another system enters the app.

| You want… | Go to |
|-----------|-------|
| Public pages (login, register, scanner, verify, tickets) | [../src/pages/public/](../src/pages/public/) |
| Admin dashboard & management screens | [../src/pages/admin/](../src/pages/admin/) |
| Gate-staff screens | [../src/pages/staff/](../src/pages/staff/) |
| Team self-service portal | [../src/pages/portal/](../src/pages/portal/) |
| The router + which URL maps to which page | [../src/App.jsx](../src/App.jsx) |
| App boot / mount | [../src/main.jsx](../src/main.jsx) |
| The REST API server (uploads, partner verify, bridge proxy) | [../server.js](../server.js) |
| Serverless functions (payments, webhooks) | [../supabase/functions/](../supabase/functions/) |
| Medal/results parser (Python) | [../scripts/medal_api.py](../scripts/medal_api.py) |

---

## 2️⃣ INTERFACE — what the user sees

Presentation only. These render data and raise events; they don't own business
logic.

| You want… | Go to |
|-----------|-------|
| Generic building blocks (Button, Modal, Input, DataTable, Toast…) | [../src/components/ui/](../src/components/ui/) |
| Page shells (Sidebar, AdminLayout, StaffLayout, ErrorBoundary) | [../src/components/layout/](../src/components/layout/) |
| Accreditation feature UI (cards, badges, exports, broadcasts) | [../src/components/accreditation/](../src/components/accreditation/) |
| Admin feature UI (box office, revenue, ticketing) | [../src/components/admin/](../src/components/admin/) |
| Teams feature UI | [../src/components/teams/](../src/components/teams/) |
| Team-portal feature UI | [../src/components/portal/](../src/components/portal/) |
| Public-facing widgets (QR gallery, spectator card) | [../src/components/public/](../src/components/public/) |
| Attendance UI | [../src/components/attendance/](../src/components/attendance/) |
| Global state (auth, theme, layout, background) | [../src/contexts/](../src/contexts/) |
| Global styles / Tailwind base | [../src/index.css](../src/index.css) |

---

## 3️⃣ DATA — logic, fetching, and storage

Everything that fetches, saves, validates, parses, or defines the database.

| You want… | Go to |
|-----------|-------|
| **The data API (the main one)** — accreditations, events, users, tickets… | [../src/lib/api/](../src/lib/api/) |
| The single import hub that re-exports all the APIs | [../src/lib/storage.js](../src/lib/storage.js) |
| The Supabase client (one place, fail-fast config) | [../src/lib/supabase.js](../src/lib/supabase.js) |
| Team / portal services | [../src/services/](../src/services/) |
| Broadcasts, email, attendance, invite links (feature data libs) | [../src/lib/](../src/lib/) |
| Parsers & helpers (PDF, Excel, fixtures, image, utils) | [../src/lib/](../src/lib/) |
| React data hooks (scanner, QR camera, sessions) | [../src/hooks/](../src/hooks/) |
| **Database schema & changes (run these on Supabase)** | [../supabase/migrations/](../supabase/migrations/) |

> 💡 `src/lib` mixes two kinds of file: **data-access** (`api/`, `*Api.js`,
> `supabase.js`) and **pure helpers** (`utils.js`, `*Parser.js`,
> `image*.js`). When reading, treat anything ending in `Api`/inside `api/` as
> "talks to the database", and the rest as "pure functions".

---

## 🔁 Follow one real request end-to-end

**"A gate scanner verifies a badge":**
1. **ENTRY** — staff open [../src/pages/public/Scanner.jsx](../src/pages/public/Scanner.jsx)
2. **INTERFACE** — the scanner UI + camera hook [../src/hooks/useQrCamera.js](../src/hooks/useQrCamera.js)
3. **DATA** — it calls the verify API [../server.js](../server.js) (`/api/v1/verify`)
4. **DATA** — which calls the DB function `verify_partner_api_key` defined in
   [../supabase/migrations/20260651_partner_api_key_hashing.sql](../supabase/migrations/20260651_partner_api_key_hashing.sql)

**"An athlete pays and gets approved":**
1. **ENTRY** — [../src/pages/public/Register.jsx](../src/pages/public/Register.jsx) → Stripe Checkout
2. **ENTRY (serverless)** — Stripe calls [../supabase/functions/stripe-webhook/index.ts](../supabase/functions/stripe-webhook/index.ts)
3. **DATA** — webhook flips the accreditation to `approved` (schema in [../supabase/migrations/](../supabase/migrations/))

---

## 🧭 "Where do I change…?" cookbook

| Task | Layer | File/folder |
|------|-------|-------------|
| Add a new admin page | ENTRY + router | new file in [../src/pages/admin/](../src/pages/admin/), wire in [../src/App.jsx](../src/App.jsx) |
| Change how something looks | INTERFACE | the matching folder in [../src/components/](../src/components/) |
| Change what data is fetched/saved | DATA | [../src/lib/api/](../src/lib/api/) |
| Add a DB table/column | DATA | new migration in [../supabase/migrations/](../supabase/migrations/) |
| Change auth/roles/permissions | DATA + rules | [../src/contexts/AuthContext.jsx](../src/contexts/AuthContext.jsx) + [../supabase/migrations/20260650_role_trust_hardening.sql](../supabase/migrations/20260650_role_trust_hardening.sql) |
| Change pricing/payment logic | ENTRY (serverless) | [../supabase/functions/create-payment-session/index.ts](../supabase/functions/create-payment-session/index.ts) |
| Security posture & controls | docs | [./SECURITY.md](./SECURITY.md) |

---

## 📦 Project root (config — you rarely touch these)

| File | Purpose |
|------|---------|
| [../package.json](../package.json) | dependencies & scripts (`dev`, `build`) |
| [../vite.config.js](../vite.config.js) | build, dev proxy, the `@` → `src` alias |
| [../vercel.json](../vercel.json) | hosting + security headers (CSP, HSTS) |
| [../tailwind.config.js](../tailwind.config.js) | design tokens |
| [../.env.example](../.env.example) | required environment variables |

See also: [SECURITY.md](./SECURITY.md) · [PRIVACY.md](./PRIVACY.md) ·
[DR_RUNBOOK.md](./DR_RUNBOOK.md) · [DATA_RETENTION.md](./DATA_RETENTION.md)
