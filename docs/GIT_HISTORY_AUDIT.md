# Git History Audit (2026-06-19)

Read-only forensic scan of the repository's **full git history** (all branches),
run to satisfy the "verify-first" gate of `INSTITUTIONAL_ROADMAP.md` Phase 0.
**Verdict: the history is NOT clean — it contains real PII, large binaries, and a
former `.env`.** A history rewrite is justified. No destructive action was taken by
this audit.

## Scope
- 313 commits across `main`, `master`, `fix/security-and-print-quality`,
  `update-ticket-email-png`, plus `origin/*` mirrors.
- Method: `git rev-list --objects --all` + `git cat-file --batch-check` (largest
  blobs), `git log --all` path/name-status (sensitive paths, `.env`).

## Findings

| # | Severity | Finding | Evidence |
|---|----------|---------|----------|
| 1 | **Critical** | **90 accreditation photos** of real people in history | `server/uploads/acc/photo-*.{jpg,png}` (90 distinct paths) |
| 2 | **Critical** | **4 ID-document uploads** (passport/ID scans) in history | `server/uploads/acc/file-*.{pdf,jpeg}` |
| 3 | **High** | **Athlete data dumps** committed | `raw_pdf_items.json` (4.6 MB), `global_settings_dump.json` (2.0 MB) |
| 4 | **High** | **`node_modules.zip` (71.9 MB)** bloats every clone permanently | blob `152473f…`, 71,913,362 bytes |
| 5 | **Low** | **`.env` was committed then deleted** — contained only `VITE_SCANNER_PIN=1234` | added `097529b`, deleted `d5f4a0c` |
| 6 | Info | **No high-value secret found** — no Supabase `service_role` key, no Stripe `sk_live/sk_test`, no password in the committed `.env` or `global_settings_dump.json` | grep of committed `.env` + dump blob |

**Why #1–#3 are Critical/High:** these are special-category / identity data of real
participants (GDPR Art. 9 / UAE PDPL). They are not in `HEAD` (current `.gitignore`
correctly ignores `server/uploads/`, `.env`, `dist`), but they remain reachable in
**history** and on **`origin/*`** mirrors. Anyone with repo access — or anyone who
ever cloned it — has them.

## Current-state confirmation (good hygiene today)
- `.env`, `.env.local`, `dist/` are **not currently tracked** (`git ls-files` errors).
- `.gitignore` correctly excludes `node_modules`, `.env*`, `dist`, `server/uploads/`,
  Terraform state, coverage. The leakage is purely **historical**.

## Remediation runbook — GATED (HIGH risk; do NOT run casually)

> This rewrites history and force-pushes. It breaks every existing clone and open
> PR. Per the project rules it requires explicit go-ahead, a full backup, and clone
> coordination. It is documented here, not executed.

**Preconditions**
1. Announce a freeze; ensure no unmerged work is unpushed by collaborators.
2. Make a full mirror backup: `git clone --mirror <url> apex-backup.git`.
3. Confirm who has clones (they must re-clone after — old clones can re-introduce the data).

**Purge (using `git filter-repo`)**
```bash
pip install git-filter-repo
git filter-repo \
  --path server/uploads \
  --path node_modules.zip \
  --path raw_pdf_items.json \
  --path global_settings_dump.json \
  --path .env \
  --invert-paths
git filter-repo --analyze        # confirm the paths are gone
```

**Re-point & push**
```bash
git remote add origin <url>      # filter-repo drops the remote
git push --force --all
git push --force --tags
```
Then **delete stale remote branches** that still carry the data
(`origin/master`, `origin/update-ticket-email-png`, the vercel branch) if obsolete,
and **purge provider caches** (GitHub: contact support to expire cached views; the
data can persist in forks/PRs).

**Rotate (defense-in-depth)**
- Scanner PIN: it was `1234` in history and is public-in-bundle anyway — rotate it,
  and complete the board item to move PIN verification server-side.
- No Supabase/Stripe secret was exposed, so no key rotation is strictly required —
  but rotating the Supabase anon key is cheap insurance if desired.

**Post-rewrite**
- Verify: `git rev-list --objects --all | git cat-file --batch-check | sort -k3 -n -r | head`
  shows no `node_modules.zip` / `server/uploads` blobs.
- Treat the exposed photos/IDs as a **possible historical disclosure** for the
  GDPR/PDPL record (they were reachable to anyone with repo access). Note it in the
  breach/awareness log even if access was limited.

## Residual / follow-up
- Forks, PR snapshots, and prior clones can re-introduce purged objects — re-clone
  everywhere and delete obsolete forks.
- This audit is read-only; the rewrite remains a deliberate, gated Phase-0 action.
