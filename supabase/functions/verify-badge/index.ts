// ============================================================================
// verify-badge — Partner Verification API (Supabase Edge Function)
//
// STATUS: SCAFFOLD — deployed but NOT yet the source of truth. This is a
// faithful TypeScript port of the `/api/v1/verify` endpoint in server.js. It
// exists so the partner API can move off the undeployed Express server. Do NOT
// cut the frontend/partners over until the parity checklist in
// docs/EDGE_MIGRATION.md passes against the live Express endpoint.
//
// Parity contract (must match server.js exactly):
//   - Requires `x-api-key` header and `{ badgeId }` JSON body.
//   - badgeId must match ^[A-Za-z0-9_-]+$ (filter-injection guard).
//   - Key is verified by SHA-256 hash via the verify_partner_api_key RPC
//     (which also stamps last_used_at). Plaintext keys are never matched.
//   - Looks up accreditation by accreditation_id | id | badge_number.
//   - Returns only the partner's allocated `allowed_fields`.
// ============================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5180",
  "http://localhost:5173",
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
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req: Request) => {
  const headers = corsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers,
    });
  }

  try {
    const apiKey = req.headers.get("x-api-key");
    const { badgeId } = await req.json().catch(() => ({}));

    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "API Key is required in x-api-key header" }),
        { status: 401, headers }
      );
    }
    if (!badgeId) {
      return new Response(
        JSON.stringify({ success: false, error: "badgeId is required in request body" }),
        { status: 400, headers }
      );
    }
    // Filter-injection guard — must match server.js.
    if (!/^[A-Za-z0-9_-]+$/.test(String(badgeId))) {
      return new Response(JSON.stringify({ success: false, error: "Invalid badgeId format" }), {
        status: 400,
        headers,
      });
    }

    // 1. Validate the API key by hash (also stamps last_used_at).
    const apiKeyHash = await sha256Hex(String(apiKey));
    const { data: keyRows, error: keyError } = await supabase.rpc("verify_partner_api_key", {
      p_key_hash: apiKeyHash,
    });
    const keyData = Array.isArray(keyRows) ? keyRows[0] : keyRows;
    if (keyError || !keyData) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or revoked API Key" }),
        { status: 403, headers }
      );
    }

    // 2. Look up the accreditation by any of its public identifiers.
    const { data: athlete, error: athleteError } = await supabase
      .from("accreditations")
      .select("*")
      .or(`accreditation_id.eq.${badgeId},id.eq.${badgeId},badge_number.eq.${badgeId}`)
      .single();

    if (athleteError || !athlete) {
      return new Response(
        JSON.stringify({ success: false, error: "Badge/Athlete not found" }),
        { status: 404, headers }
      );
    }

    // 3. Return only the fields allocated to this key.
    const allowedFields =
      Array.isArray(keyData.allowed_fields) && keyData.allowed_fields.length
        ? keyData.allowed_fields
        : ["firstName", "lastName", "role", "badgeNumber"];

    const fieldMap: Record<string, unknown> = {
      firstName: athlete.first_name,
      lastName: athlete.last_name,
      role: athlete.role,
      badgeNumber: athlete.badge_number,
      club: athlete.club,
      nationality: athlete.nationality,
      photoUrl: athlete.photo_url,
      status: athlete.status,
      bookingData: athlete.custom_message
        ? typeof athlete.custom_message === "string"
          ? JSON.parse(athlete.custom_message)
          : athlete.custom_message
        : null,
    };

    const filteredData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (fieldMap[field] !== undefined) filteredData[field] = fieldMap[field];
    }

    return new Response(
      JSON.stringify({ success: true, partner: keyData.partner_name, data: filteredData }),
      { status: 200, headers }
    );
  } catch (err) {
    console.error("verify-badge error:", (err as Error).message);
    return new Response(JSON.stringify({ success: false, error: "Internal Server Error" }), {
      status: 500,
      headers,
    });
  }
});
