# Scanner PIN — server-side hardening (DESIGN — needs review before client wiring)

## The exposure (today)
The scanner gate (`src/pages/public/Scanner.jsx`) authorises clients by comparing
PINs **in the browser**:
- `handleAuth` (line ~279) fetches `event_<id>_scanner_pin` from `global_settings`
  to the client, then compares `pinInput === customPin` client-side. The event
  PIN travels to anyone who opens the page.
- The global fallback PIN is `VITE_SCANNER_PIN` (line 144), **baked into the
  public JS bundle** — readable by anyone, and also printed in the admin UI
  (`src/pages/admin/Events.jsx:1333`).
- A URL-kiosk bypass (line ~208) auto-authorises when `?pin=` equals
  `defaultPin` — same client-side secret.

Net: the scanner PIN is not a server-enforced secret. Anyone can recover it.

## The fix (additive, already built)
`supabase/functions/verify-scanner-pin/index.ts` — public edge fn that compares
server-side (service role) and returns ONLY `{ valid: boolean }`, never the PIN.
Checks the event PIN (global_settings) and a global fallback from the
`SCANNER_DEFAULT_PIN` function secret. `verify_jwt=false` in config.toml.
Deploying it changes nothing until the client is wired.

## Client wiring — ✅ DONE (flag-gated: `VITE_SERVER_SCANNER_PIN`, default OFF)
Implemented; flag OFF = today's behaviour, zero regression. What landed:
1. `src/lib/scannerPin.js` → `verifyScannerPin(eventId, pin)` +
   `isServerScannerPinEnabled()`:
   - flag OFF (default): current behaviour — `GlobalSettingsAPI.get` +
     `VITE_SCANNER_PIN` client compare (a settings-fetch error propagates so the
     gate still shows "Connection Error").
   - flag ON: `supabase.functions.invoke('verify-scanner-pin', { body:{eventId,pin} })`
     → returns `data.valid`; **fails closed** on any error (no authorise on
     network/server failure).
   - Unit-tested both modes (`src/lib/scannerPin.test.js`, 10 tests).
2. `Scanner.handleAuth` and the URL-kiosk auto-auth both route through the helper.
3. Admin PIN display (`Events.jsx`) shows "Server-managed" when the flag is on.
   `getAthleteInfoLink` already tolerates an absent `VITE_SCANNER_PIN` (omits the
   `&pin=`), so dropping the build var degrades the kiosk to manual entry safely.

**Remaining to actually close the gate (cloud steps — your turn):** set the
`SCANNER_DEFAULT_PIN` secret, flip `VITE_SERVER_SCANNER_PIN=true` on staging,
soak, then remove `VITE_SCANNER_PIN` from the build so the PIN leaves the bundle.

## Env-secret migration
- Set the function secret (NOT a VITE_ var — those are public):
  `npx supabase@latest secrets set SCANNER_DEFAULT_PIN="<pin>" --project-ref bieqfzwljxkmmldmlzyb`
- Keep `VITE_SCANNER_PIN` in `.env.staging` until the flag is ON and soaked, then
  remove it from the build so it's no longer in the bundle.

## Cutover (staging first)
1. Deploy: `npx supabase@latest functions deploy verify-scanner-pin --project-ref bieqfzwljxkmmldmlzyb --no-verify-jwt`
2. Set `SCANNER_DEFAULT_PIN` secret (above).
3. Smoke: `curl -s -X POST https://bieqfzwljxkmmldmlzyb.functions.supabase.co/verify-scanner-pin -H 'Content-Type: application/json' -d '{"eventId":"<EV>","pin":"<wrong>"}'` → `{"valid":false}`; correct PIN → `{"valid":true}`.
4. After client wiring lands: set `VITE_SERVER_SCANNER_PIN=true` in `.env.staging`,
   rebuild + isolation grep + redeploy, soak the scanner gate (event PIN + global
   PIN + URL kiosk), confirm the PIN no longer appears in any network response or
   in the JS bundle.
5. Live cutover is a separate deliberate step.

## Open question for review
- Keep the URL-kiosk `?pin=` bypass at all? It's the weakest path (PIN in a
  shareable URL). Options: route it through the edge fn too, or drop it.
