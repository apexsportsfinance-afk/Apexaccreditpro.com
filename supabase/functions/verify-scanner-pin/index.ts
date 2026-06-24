// ============================================================================
// verify-scanner-pin — server-side scanner PIN check (Supabase Edge Function)
//
// WHY: today Scanner.jsx authorises the gate by (a) fetching the event PIN
// (`event_<id>_scanner_pin` in global_settings) to the browser and comparing it
// client-side, and (b) comparing against `VITE_SCANNER_PIN`, which is baked into
// the public bundle. Both expose the PIN to anyone with devtools. This function
// moves the comparison server-side: it returns ONLY a boolean and never echoes
// the stored PIN, so the secret never reaches the client.
//
// STATUS: additive. Deploying this changes nothing until Scanner.jsx is wired to
// it behind the `VITE_SERVER_SCANNER_PIN` flag (flag OFF = today's behaviour).
// See docs/runbooks/SCANNER_PIN_server_side.md for the env-secret migration and
// the flag cutover.
//
// Contract:  POST { eventId?, pin } -> { valid: boolean }
// Deploy PUBLIC (no JWT): verify_jwt=false in supabase/config.toml.
// Requires the function secret SCANNER_DEFAULT_PIN (the global fallback PIN that
// today lives in VITE_SCANNER_PIN).
// ============================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const DEFAULT_PIN = Deno.env.get("SCANNER_DEFAULT_PIN") ?? "";

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5180",
  "https://apex-staging-2ft.pages.dev",
  "https://accreditation.apexsports.ae",
];
const extraOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = new Set([...DEFAULT_ALLOWED_ORIGINS, ...extraOrigins]);

function corsHeaders(origin: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : DEFAULT_ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
}

// Length-independent constant-time string compare — avoids leaking match length
// or position via response timing.
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  // Compare against max length so the loop count doesn't depend on the secret.
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

function isValidEventId(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 128 && /^[A-Za-z0-9_-]+$/.test(v);
}

serve(async (req: Request) => {
  const headers = corsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ valid: false, error: "Method not allowed" }), { status: 405, headers });
  }

  try {
    const { eventId, pin } = (await req.json().catch(() => ({}))) ?? {};

    // No PIN -> never valid (fail closed). Bound the length to avoid abuse.
    if (typeof pin !== "string" || pin.length === 0 || pin.length > 256) {
      return new Response(JSON.stringify({ valid: false }), { status: 200, headers });
    }

    let valid = false;

    // 1. Event-specific PIN (global_settings), if an event was supplied.
    if (isValidEventId(eventId)) {
      const { data } = await supabase
        .from("global_settings")
        .select("value")
        .eq("key", `event_${eventId}_scanner_pin`)
        .maybeSingle();
      const eventPin = data?.value;
      if (typeof eventPin === "string" && eventPin.length > 0 && timingSafeEqual(pin, eventPin)) {
        valid = true;
      }
    }

    // 2. Global fallback PIN (server secret). Only matches when configured.
    if (!valid && DEFAULT_PIN.length > 0 && timingSafeEqual(pin, DEFAULT_PIN)) {
      valid = true;
    }

    return new Response(JSON.stringify({ valid }), { status: 200, headers });
  } catch (err) {
    console.error("verify-scanner-pin error:", (err as Error).message);
    // Fail closed on errors — never authorise on an exception.
    return new Response(JSON.stringify({ valid: false, error: "Internal Server Error" }), { status: 500, headers });
  }
});
