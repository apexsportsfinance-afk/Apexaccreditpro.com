# ============================================================================
# deploy-edge-live.ps1 — PowerShell port of deploy-edge-live.sh
#
# Guarded LIVE edge-function deploy. DRY-RUN by default; executes real deploys
# only when $env:APEX_LIVE_DEPLOY = 'yes'. Always passes --project-ref explicitly
# (config.toml project_id is LIVE, so we never rely on the implicit default).
#
# Usage (Windows PowerShell):
#   .\scripts\deploy-edge-live.ps1 preflight            # read-only
#   .\scripts\deploy-edge-live.ps1 groupA               # dry-run (prints only)
#   $env:APEX_LIVE_DEPLOY = 'yes'
#   .\scripts\deploy-edge-live.ps1 groupA               # additive first (safe)
#   .\scripts\deploy-edge-live.ps1 groupB               # payments (after staging Stripe test)
#   Remove-Item Env:\APEX_LIVE_DEPLOY                    # clear the guard
#   .\scripts\deploy-edge-live.ps1 smoke groupA         # smoke only
#
# Optional env: $env:LIVE_REF, $env:LIVE_ANON_KEY (enables smokes), $env:LIVE_ORIGIN
# ============================================================================
param(
  [Parameter(Mandatory = $true)][string]$Command,
  [string]$Group
)
$ErrorActionPreference = 'Stop'

$LiveRef    = if ($env:LIVE_REF)    { $env:LIVE_REF }    else { 'dixelomafeobabahqeqg' }
$LiveOrigin = if ($env:LIVE_ORIGIN) { $env:LIVE_ORIGIN } else { 'https://accreditation.apexsports.ae' }
$AnonKey    = $env:LIVE_ANON_KEY
$FnBase     = "https://$LiveRef.functions.supabase.co"
$Exec       = ($env:APEX_LIVE_DEPLOY -eq 'yes')

# function groups (verified against frontend wiring 2026-06-21)
$GroupA_Public  = @('public-verify-assets','verify-scanner-pin')   # deploy --no-verify-jwt
$GroupA_Jwt     = @('parse-results','verify-badge')
$GroupB_Public  = @('stripe-webhook')                              # deploy --no-verify-jwt
$GroupB_Jwt     = @('create-payment-session','verify-session','send-accreditation-email')
$GroupA_Secrets = @('SCANNER_DEFAULT_PIN','ALLOWED_ORIGINS')
$GroupB_Secrets = @('STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','ALLOWED_ORIGINS')

function Say($m)  { Write-Host "`n$m" -ForegroundColor Cyan }
function Note($m) { Write-Host "  $m" }

function Deploy($fns, $noVerifyJwt) {
  foreach ($fn in $fns) {
    $a = @('functions','deploy',$fn,'--project-ref',$LiveRef)
    if ($noVerifyJwt) { $a += '--no-verify-jwt' }
    $line = 'supabase ' + ($a -join ' ')
    if ($Exec) { Note ('RUN: ' + $line); & supabase @a }
    else       { Note ('DRY: ' + $line) }
  }
}

# Returns the HTTP status code as a string (uses bundled curl.exe).
function Status($url, $method, $body) {
  $h = @('-s','-o','NUL','-w','%{http_code}','-X',$method,'-H',"Origin: $LiveOrigin")
  if ($AnonKey) { $h += @('-H',"apikey: $AnonKey",'-H',"Authorization: Bearer $AnonKey") }
  if ($method -eq 'POST') {
    $payload = if ($body) { $body } else { '{}' }
    $h += @('-H','Content-Type: application/json','-d',$payload)
  }
  return (& curl.exe @h $url)
}
function Check($label, $val) { Write-Host ("  {0,-30} {1}" -f $label, $val) }

function SmokeA {
  Say 'Smoke Group A (expect: alive, sane negatives)'
  $s1 = Status "$FnBase/public-verify-assets" 'OPTIONS' $null
  $s2 = Status "$FnBase/public-verify-assets" 'POST' '{"scope":"branding","eventId":"x","paths":[]}'
  $s3 = Status "$FnBase/verify-scanner-pin" 'OPTIONS' $null
  $s4 = Status "$FnBase/parse-results" 'OPTIONS' $null
  $s5 = Status "$FnBase/parse-results" 'POST' '{}'
  $s6 = Status "$FnBase/verify-badge" 'POST' '{}'
  Check 'public-verify-assets OPTIONS' ($s1 + '  (want 200)')
  Check 'public-verify-assets empty'   ($s2 + '  (want 200, body urls:{})')
  Check 'verify-scanner-pin OPTIONS'   ($s3 + '  (want 200)')
  Check 'parse-results OPTIONS'        ($s4 + '  (want 200)')
  Check 'parse-results no-files'       ($s5 + '  (want 400 No files provided)')
  Check 'verify-badge no-key'          ($s6 + '  (want 400/401)')
}
function SmokeB {
  Say 'Smoke Group B (expect: alive, NO side effects)'
  $s1 = Status "$FnBase/stripe-webhook" 'POST' '{}'
  $s2 = Status "$FnBase/create-payment-session" 'POST' '{"type":"__none__"}'
  $s3 = Status "$FnBase/verify-session" 'OPTIONS' $null
  $s4 = Status "$FnBase/send-accreditation-email" 'OPTIONS' $null
  Check 'stripe-webhook no-sig'        ($s1 + '  (want 400 Missing signature)')
  Check 'create-payment-session bad'   ($s2 + '  (want 400 Invalid payment type)')
  Check 'verify-session OPTIONS'       ($s3 + '  (want 200/204)')
  Check 'send-accreditation-email OPT' ($s4 + '  (want 200/204)')
}

switch ($Command) {
  'preflight' {
    Say "Pre-flight - LIVE ref: $LiveRef"
    Say 'Functions deployed on LIVE'
    & supabase functions list --project-ref $LiveRef
    Say 'Secrets present on LIVE (digests only)'
    & supabase secrets list --project-ref $LiveRef
    Say ('Group A needs: ' + ($GroupA_Secrets -join ', '))
    Note ('Group B needs: ' + ($GroupB_Secrets -join ', '))
    Note 'verify-badge: at partner-API cutover, redeploy it with --no-verify-jwt'
  }
  'groupA' {
    Say 'GROUP A - additive functions (no live-frontend usage today)'
    Deploy $GroupA_Public $true
    Deploy $GroupA_Jwt    $false
    if ($Exec) { SmokeA } else { Say 'DRY-RUN. Set $env:APEX_LIVE_DEPLOY=yes to execute against LIVE.' }
  }
  'groupB' {
    Say 'GROUP B - REPLACES live customer-serving handlers. Deploy deliberately.'
    Note ('Pre-flight: confirm ' + ($GroupB_Secrets -join ', ') + ' are set on LIVE.')
    Deploy $GroupB_Public $true
    Deploy $GroupB_Jwt    $false
    if ($Exec) { SmokeB } else { Say 'DRY-RUN. Set $env:APEX_LIVE_DEPLOY=yes to execute against LIVE.' }
  }
  'smoke' {
    switch ($Group) {
      'groupA' { SmokeA }
      'groupB' { SmokeB }
      default  { Write-Host 'usage: .\scripts\deploy-edge-live.ps1 smoke {groupA|groupB}' }
    }
  }
  default {
    Write-Host 'usage: .\scripts\deploy-edge-live.ps1 {preflight|groupA|groupB|smoke groupA|smoke groupB}'
    Write-Host '  DRY-RUN unless $env:APEX_LIVE_DEPLOY=yes'
  }
}
