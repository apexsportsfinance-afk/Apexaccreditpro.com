# Dependency Risk Notes (2026-06-12)

`npm audit` after the latest `npm install` + `npm audit fix` (which removed the
`react-router`/`react-router-dom` open-redirect issue and, via a `concurrently`
major-version bump, the `shell-quote` critical issue in the dev tooling) shows
4 remaining groups. None of these have a low-risk in-range fix, so they are
recorded here as accepted risk with mitigations and a follow-up upgrade path.

## 1. `jspdf` <= 4.2.0 / `dompurify` <= 3.3.3 (npm audit: critical)

- **What it is**: jsPDF bundles `dompurify` for its `.html()` method (renders
  arbitrary HTML into a PDF). The flagged advisories (XSS/sanitizer bypasses,
  PDF/AcroForm injection, ReDoS, path traversal in `addJS`/image decoders) are
  all in that HTML-rendering and form/JS-embedding code path.
- **Exploitability here**: grep confirms **`jsPDF.html()` is not called
  anywhere in `src/`** — badges/tickets/PDFs are built via `addImage`/`text`/
  `rect` from canvas captures (`pdfCapture.js`, `cardExport.js`,
  `exportUtils.js`). The vulnerable code paths are not reachable from this
  app's usage.
- **Why not upgrade now**: the only fix is `jspdf@4.2.1` (a 2-major bump from
  the current `2.5.2`). A prior jsPDF upgrade attempt caused a render-timing
  regression in badge PDFs (see
  `docs/history/2026-04-28-pdf-stability/`), and jsPDF 3.x/4.x changed several
  APIs (`addImage`/font handling). Re-testing every badge/ticket/membership
  card template against a 4.x API change is out of scope for this pass.
- **Follow-up**: schedule a dedicated pass to upgrade to `jspdf@4.2.1` +
  `jspdf-autotable@5.x`, visually diff every PDF template (badges, membership
  cards, tickets, attendance sheets, audit/export reports) before shipping.

## 2. `esbuild` <= 0.24.2 / `vite` <= 6.4.1 (npm audit: moderate)

- **What it is**: `GHSA-67mh-4wv8-2f99` — the Vite **dev server** will respond
  to cross-origin requests from any website, potentially leaking source files
  served by the dev server.
- **Exploitability here**: only affects `vite` (the dev server)/`vite preview`
  running locally — not the production build artifact served by Vercel. Risk
  is limited to a developer's machine while `npm run dev` is running.
- **Why not upgrade now**: fixing requires `vite@8`, a 4-major bump from the
  current `^4.4.5`. `@vitejs/plugin-react@4`, `@vitejs/plugin-basic-ssl@1`, and
  `vite-plugin-pwa@1.3.0` all have peer-dependency ranges tied to Vite 4/5 —
  bumping Vite alone is very likely to break `npm run build` and the PWA
  manifest generation.
- **Mitigation in the meantime**: don't expose the Vite dev server port
  (5173/5180) beyond localhost; this is already the case (CORS allow-lists
  added in this pass only widen *server.js*/Edge Function origins, not the
  Vite dev server's own bind address).
- **Follow-up**: upgrade Vite, `@vitejs/plugin-react`, `vite-plugin-pwa`, and
  `@vitejs/plugin-basic-ssl` together in one pass, then run a full
  `npm run build` + `npm run preview` regression pass.

## 3. `xlsx` (SheetJS) — Prototype Pollution + ReDoS (npm audit: high, no fix on npm)

- **What it is**: `GHSA-4r6h-8v6p-xvw6` (prototype pollution) and
  `GHSA-5pgg-2g8v-p4x9` (ReDoS) when parsing a crafted spreadsheet via
  `XLSX.read(...)`.
- **Where it's used**: `src/lib/excelParser.js` (`XLSX.read`), used by admin
  bulk-import flows (`Events.jsx`, `Ticketing.jsx`, `AuditLog.jsx`,
  `SportEventsManager.jsx`, etc.) — all behind the admin auth wall.
- **Why "no fix available" on npm**: SheetJS stopped publishing patched
  releases to the npm registry; fixed builds (>= 0.20.2) are only published to
  `https://cdn.sheetjs.com`.
- **Mitigation in the meantime**: spreadsheet import is restricted to
  authenticated admin/staff roles, which limits this to a malicious-insider or
  compromised-admin-account scenario.
- **Follow-up**: switch the `xlsx` dependency to the SheetJS-hosted fixed
  tarball, e.g. in `package.json`:
  `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"`, then
  `npm install` and re-test every import flow listed above.

## 4. `face-api.js` -> `@tensorflow/tfjs-core` -> `node-fetch` <= 2.6.6 (npm audit: low/high)

- **What it is**: `node-fetch` header-forwarding and redirect-size issues.
- **Exploitability here**: `@tensorflow/tfjs-core`'s `node-fetch` dependency is
  part of its **Node.js** backend, which this app never imports — the browser
  build of `face-api.js` (`FaceMatchingManager.jsx`) uses the browser
  `fetch`/WebGL backend, not `node-fetch`. Not reachable from the shipped
  bundle.
- **Why not upgrade now**: the only fix is `face-api.js@0.20.0`, a *downgrade*
  from the current `^0.22.2` that would remove APIs already in use
  (`FaceMatchingManager.jsx` relies on 0.22.x model-loading helpers).
- **Follow-up**: revisit if/when `face-api.js` publishes a release on its
  current major line with an updated `@tensorflow/tfjs-core`.

## Summary

| Package | Severity | Fix available | Action taken |
|---|---|---|---|
| `react-router(-dom)` | moderate | yes (in-range) | ✅ fixed via `npm audit fix` |
| `concurrently`/`shell-quote` | critical | yes (major bump, dev-only) | ✅ upgraded `concurrently` |
| `jspdf`/`dompurify` | critical | major bump only | documented, deferred (no reachable `.html()` usage) |
| `vite`/`esbuild` | moderate | major bump only | documented, deferred (dev-server only) |
| `xlsx` | high | CDN tarball only | documented, deferred (admin-only feature) |
| `face-api.js`/`tfjs-core`/`node-fetch` | low/high | downgrade only | documented, deferred (unreachable Node backend) |
