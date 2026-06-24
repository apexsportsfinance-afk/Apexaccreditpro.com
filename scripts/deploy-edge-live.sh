#!/usr/bin/env bash
# ============================================================================
# deploy-edge-live.sh — guarded LIVE edge-function deploy for ApexAccreditPro
#
# Deploys Supabase Edge Functions to the LIVE project in a SAFE, staged order:
#   GROUP A (additive)  — functions the live frontend does NOT call yet, so
#                         deploying them has ZERO customer impact. Safe anytime.
#   GROUP B (in-prod)   — functions that REPLACE live, customer-serving handlers
#                         (payments, webhooks, email). Deploy deliberately, then
#                         smoke. A bad deploy here can break checkout/fulfilment.
#
# This script is DRY-RUN by default. It only executes real deploys when you set
#   APEX_LIVE_DEPLOY=yes
# and pass a group. Mirrors the guard pattern in scripts/purge-git-history.sh.
#
# Safety invariants:
#   - ALWAYS passes --project-ref explicitly (config.toml project_id is LIVE, so a
#     bare `supabase functions deploy` would also hit LIVE — we never rely on that).
#   - Public functions are deployed with --no-verify-jwt to match config.toml.
#   - Pre-flight checks that the secrets each group needs are already set on LIVE.
#   - Post-deploy smoke uses negative/liveness paths only — NO side effects
#     (no real payment, email, or webhook is created).
#
# Usage:
#   # 1. Pre-flight only (read-only): what's deployed, what secrets exist
#   bash scripts/deploy-edge-live.sh preflight
#
#   # 2. Dry-run a group (prints the exact commands, executes nothing)
#   bash scripts/deploy-edge-live.sh groupA
#
#   # 3. Really deploy a group (additive first, smoke, THEN payments later)
#   APEX_LIVE_DEPLOY=yes bash scripts/deploy-edge-live.sh groupA
#   APEX_LIVE_DEPLOY=yes bash scripts/deploy-edge-live.sh groupB
#
#   # Smoke an already-deployed group without redeploying
#   bash scripts/deploy-edge-live.sh smoke groupA
#
# Env:
#   LIVE_REF        LIVE project ref         (default: dixelomafeobabahqeqg)
#   LIVE_ANON_KEY   live anon JWT for smokes (optional; smokes skipped if unset)
#   LIVE_ORIGIN     allowed origin for CORS  (default: https://accreditation.apexsports.ae)
# ============================================================================
set -euo pipefail

LIVE_REF="${LIVE_REF:-dixelomafeobabahqeqg}"
LIVE_ORIGIN="${LIVE_ORIGIN:-https://accreditation.apexsports.ae}"
FN_BASE="https://${LIVE_REF}.functions.supabase.co"

# --- function groups (verified against frontend wiring 2026-06-21) ------------
GROUP_A_PUBLIC=(public-verify-assets verify-scanner-pin)   # deploy --no-verify-jwt
GROUP_A_JWT=(parse-results verify-badge)                   # JWT-gated (admin/partner)
GROUP_B_PUBLIC=(stripe-webhook)                            # deploy --no-verify-jwt
GROUP_B_JWT=(create-payment-session verify-session send-accreditation-email)

# Secrets each group needs to NOT 500 at runtime (SUPABASE_* are auto-injected).
GROUP_A_SECRETS=(SCANNER_DEFAULT_PIN ALLOWED_ORIGINS)
GROUP_B_SECRETS=(STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET ALLOWED_ORIGINS)

EXEC=0
[ "${APEX_LIVE_DEPLOY:-no}" = "yes" ] && EXEC=1

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
note() { printf '  %s\n' "$*"; }
run()  {
  if [ "$EXEC" = "1" ]; then
    note "RUN: $*"; "$@"
  else
    note "DRY: $*"
  fi
}

require_cli() {
  command -v supabase >/dev/null 2>&1 || { echo "ERROR: supabase CLI not on PATH"; exit 1; }
}

preflight() {
  require_cli
  say "Pre-flight — LIVE ref: $LIVE_REF"
  say "Functions currently deployed on LIVE"
  supabase functions list --project-ref "$LIVE_REF" || true
  say "Secrets present on LIVE (digests only)"
  supabase secrets list --project-ref "$LIVE_REF" || true
  say "Reminder: confirm these secrets exist before each group:"
  note "Group A needs: ${GROUP_A_SECRETS[*]}"
  note "Group B needs: ${GROUP_B_SECRETS[*]}"
  note "verify-badge: when you CUT OVER the partner API, it must be --no-verify-jwt"
  note "(partners send x-api-key, not a Supabase JWT). It is JWT-gated here because"
  note "it is not cut over yet — deploying it now is inert."
}

deploy_public() { for fn in "$@"; do run supabase functions deploy "$fn" --project-ref "$LIVE_REF" --no-verify-jwt; done; }
deploy_jwt()    { for fn in "$@"; do run supabase functions deploy "$fn" --project-ref "$LIVE_REF"; done; }

confirm_exec() {
  if [ "$EXEC" != "1" ]; then
    say "DRY-RUN. Re-run with APEX_LIVE_DEPLOY=yes to execute the above against LIVE."
    return 1
  fi
  return 0
}

# --- smokes (negative/liveness only — no side effects) ------------------------
post() { curl -s -o /dev/null -w "%{http_code}" "$1" -X POST -H "Content-Type: application/json" ${LIVE_ANON_KEY:+-H "apikey: $LIVE_ANON_KEY"} ${LIVE_ANON_KEY:+-H "Authorization: Bearer $LIVE_ANON_KEY"} -H "Origin: $LIVE_ORIGIN" -d "${2:-{}}"; }
opt()  { curl -s -o /dev/null -w "%{http_code}" "$1" -X OPTIONS -H "Origin: $LIVE_ORIGIN" ${LIVE_ANON_KEY:+-H "apikey: $LIVE_ANON_KEY"}; }
check(){ printf '  %-28s %s\n' "$1" "$2"; }

smoke_groupA() {
  say "Smoke Group A (expect: alive, sane negative paths)"
  check "public-verify-assets OPTIONS" "$(opt  "$FN_BASE/public-verify-assets")  (want 200)"
  check "public-verify-assets empty"   "$(post "$FN_BASE/public-verify-assets" '{"scope":"branding","eventId":"x","paths":[]}')  (want 200, body {\"urls\":{}})"
  check "verify-scanner-pin OPTIONS"   "$(opt  "$FN_BASE/verify-scanner-pin")  (want 200)"
  check "parse-results OPTIONS"        "$(opt  "$FN_BASE/parse-results")  (want 200)"
  check "parse-results no-files"       "$(post "$FN_BASE/parse-results")  (want 400 No files provided)"
  check "verify-badge no-key"          "$(post "$FN_BASE/verify-badge")  (want 400/401)"
}

smoke_groupB() {
  say "Smoke Group B (expect: alive, NO side effects)"
  check "stripe-webhook no-sig"        "$(post "$FN_BASE/stripe-webhook")  (want 400 Missing signature)"
  check "create-payment-session bad"   "$(post "$FN_BASE/create-payment-session" '{"type":"__none__"}')  (want 400 Invalid payment type)"
  check "verify-session OPTIONS"       "$(opt  "$FN_BASE/verify-session")  (want 200/204)"
  check "send-accreditation-email OPT" "$(opt  "$FN_BASE/send-accreditation-email")  (want 200/204)"
}

main() {
  case "${1:-}" in
    preflight) preflight ;;
    groupA)
      require_cli
      say "GROUP A — additive functions (no live-frontend usage today)"
      deploy_public "${GROUP_A_PUBLIC[@]}"
      deploy_jwt    "${GROUP_A_JWT[@]}"
      confirm_exec && smoke_groupA || true
      ;;
    groupB)
      require_cli
      say "GROUP B — REPLACES live customer-serving handlers. Deploy deliberately."
      say "  Pre-flight: confirm ${GROUP_B_SECRETS[*]} are set on LIVE (run: $0 preflight)"
      deploy_public "${GROUP_B_PUBLIC[@]}"
      deploy_jwt    "${GROUP_B_JWT[@]}"
      confirm_exec && smoke_groupB || true
      ;;
    smoke)
      case "${2:-}" in
        groupA) smoke_groupA ;;
        groupB) smoke_groupB ;;
        *) echo "usage: $0 smoke {groupA|groupB}"; exit 1 ;;
      esac
      ;;
    *)
      echo "usage: $0 {preflight|groupA|groupB|smoke groupA|smoke groupB}"
      echo "  DRY-RUN unless APEX_LIVE_DEPLOY=yes is set."
      exit 1
      ;;
  esac
}
main "$@"
