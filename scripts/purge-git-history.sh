#!/usr/bin/env bash
#
# Plan 1 (IP purge) — turnkey, GUARDED git-history rewrite.
#
# Removes the PII photos, ID scans, data dumps, node_modules.zip and the former
# .env from the ENTIRE git history (see docs/GIT_HISTORY_AUDIT.md for the
# forensic findings this purges).
#
# ⚠️  THIS REWRITES HISTORY. It breaks every existing clone and open PR. By
#     design this script does the SAFE, local part only:
#       1. hard preconditions + a full mirror backup,
#       2. the git-filter-repo purge,
#       3. verification that the blobs are gone.
#     It DELIBERATELY does NOT force-push. The destructive remote step
#     (git push --force) and the PIN/anon-key rotation are left for you to run
#     by hand, consciously, after you have re-read the runbook and announced a
#     freeze. See the "NEXT (manual)" block this script prints at the end.
#
# Usage (from the repo root):
#     I_UNDERSTAND_THIS_REWRITES_HISTORY=yes bash scripts/purge-git-history.sh
#
set -euo pipefail

# --- Guard: refuse to run unless the operator has explicitly acknowledged. ----
if [ "${I_UNDERSTAND_THIS_REWRITES_HISTORY:-}" != "yes" ]; then
  cat >&2 <<'EOF'
REFUSING TO RUN.

This script rewrites git history (destructive, irreversible for clones).
Re-run with the explicit acknowledgement set:

    I_UNDERSTAND_THIS_REWRITES_HISTORY=yes bash scripts/purge-git-history.sh

Before you do: read docs/GIT_HISTORY_AUDIT.md, announce a freeze, and make sure
no collaborator has unpushed work.
EOF
  exit 1
fi

# --- Preconditions ------------------------------------------------------------
if [ ! -d .git ]; then
  echo "ERROR: run this from the repository root (no .git here)." >&2
  exit 1
fi

if ! command -v git-filter-repo >/dev/null 2>&1 && ! python -c "import git_filter_repo" >/dev/null 2>&1; then
  echo "ERROR: git-filter-repo is not installed. Install it first:" >&2
  echo "    pip install git-filter-repo" >&2
  exit 1
fi

REMOTE_URL="$(git remote get-url origin 2>/dev/null || true)"

echo "==> Repo:        $(pwd)"
echo "==> origin:      ${REMOTE_URL:-<none>}"
echo "==> HEAD:        $(git rev-parse --short HEAD) on $(git rev-parse --abbrev-ref HEAD)"
echo

# --- 1. Full mirror backup (so the rewrite is reversible locally) -------------
BACKUP_DIR="../apex-history-backup-$(date +%Y%m%d-%H%M%S).git"
echo "==> [1/3] Mirror backup -> ${BACKUP_DIR}"
git clone --mirror . "${BACKUP_DIR}"
echo "    Backup written. To restore: git clone ${BACKUP_DIR} restored-repo"
echo

# --- 2. Purge the sensitive paths from ALL history ----------------------------
# Paths come straight from docs/GIT_HISTORY_AUDIT.md findings #1-#5.
echo "==> [2/3] Purging sensitive paths from history (git filter-repo)"
git filter-repo \
  --path server/uploads \
  --path node_modules.zip \
  --path raw_pdf_items.json \
  --path global_settings_dump.json \
  --path .env \
  --invert-paths
echo

# --- 3. Verify the blobs are gone ---------------------------------------------
echo "==> [3/3] Verifying — these greps should print NOTHING:"
LEFTOVERS="$(
  git rev-list --objects --all \
    | grep -E 'server/uploads|node_modules\.zip|raw_pdf_items\.json|global_settings_dump\.json|(^|/)\.env$' \
    || true
)"
if [ -n "${LEFTOVERS}" ]; then
  echo "!! Still present after purge:" >&2
  echo "${LEFTOVERS}" >&2
  exit 1
fi
echo "    Clean: none of the purged paths remain reachable in history."
echo

cat <<EOF
============================================================================
PURGE COMPLETE (local history rewritten; mirror backup at ${BACKUP_DIR}).

NEXT (manual — destructive, run consciously):
  1. Re-add the remote (filter-repo drops it):
       git remote add origin ${REMOTE_URL:-<your-repo-url>}
  2. Force-push the rewritten history (ONLY after announcing a freeze):
       git push --force --all
       git push --force --tags
  3. Delete stale remote branches still carrying the data (origin/master,
     origin/update-ticket-email-png, the vercel branch) if obsolete.
  4. Re-clone EVERYWHERE; delete obsolete forks (old clones/forks can
     re-introduce the purged objects). Ask GitHub support to expire cached views.
  5. Rotate: change the Scanner PIN (was 1234 in history) and finish moving PIN
     verification server-side. Anon-key rotation is optional defence-in-depth.
  6. Log the historical PII exposure in the breach/awareness record (GDPR/PDPL).

See docs/GIT_HISTORY_AUDIT.md for the full rationale.
============================================================================
EOF
