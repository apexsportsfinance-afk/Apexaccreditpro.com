// ============================================================================
// public-verify-assets — Public signed-URL issuer for anonymous pages
//
// PURPOSE: when the storage bucket is flipped PRIVATE (Phase 0 institutional
// cutover, VITE_PRIVATE_STORAGE=true), anonymous pages (badge verification,
// scanner, registration, card previews) can no longer client-sign storage
// objects. This function issues short-lived signed URLs for EXACTLY the asset
// set those public surfaces already render today — parity, no new exposure.
//
// ANTI-ORACLE DESIGN: the client never hands a path to be signed blindly. The
// server re-derives, with the service role, an ALLOWLIST of the storage paths
// that the requested verification context legitimately exposes (from the
// accreditation row / event row / event docs / gallery / matches it owns), then
// signs ONLY requested paths that are in that allowlist. Anything else is
// silently dropped. Sensitive documents (ID / passport / medical) are never on
// any verification surface, so they are never in an allowlist and stay dark.
//
// Modeled on supabase/functions/verify-badge/index.ts.
//
// Contract:
//   POST { accreditationId?, eventId?, scope, paths: string[], expiresIn? }
//        -> { urls: { [normalizedPath]: signedUrl } }
//   scope:
//     "profile"  (needs accreditationId) - that athlete's photo + result/heat
//                 PDFs, plus its event's branding, event docs and broadcast
//                 attachments. Covers VerifyAccreditation, Scanner, card previews.
//     "branding" (needs eventId)         - event logo / back template / sponsor
//                 logos only. Covers registration pages with no accreditation yet.
//     "gallery"  (needs eventId)         - public event_photos (url + thumbnail).
//     "live"     (needs eventId)         - team logos on the event's matches.
//
// Deploy PUBLIC (no JWT): `supabase functions deploy public-verify-assets
//   --no-verify-jwt` (or the [functions.public-verify-assets] verify_jwt=false
//   block in supabase/config.toml).
// ============================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// The app uses exactly one bucket repo-wide.
const BUCKET = "accreditation-files";
const DEFAULT_EXPIRY = 60 * 60; // 1 hour
const MAX_EXPIRY = 60 * 60;
const MIN_EXPIRY = 60;
const MAX_PATHS = 200;

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

function json(obj: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(obj), { status, headers });
}

// Accepts UUIDs (hyphens), accreditation ids ("ACC-1234"), badge numbers — and
// blocks anything that could break out of a PostgREST .or() filter.
function isValidId(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 128 && /^[A-Za-z0-9_-]+$/.test(v);
}

// Mirror of src/lib/storage/fileUrl.js parseStorageRef: normalize a stored value
// (bare in-bucket path OR full Supabase storage URL) to an in-bucket path.
// Returns null for external URLs we don't own (flagcdn, data:, blob:, etc.).
const STORAGE_URL_RE = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/;
function normalizePath(value: unknown): string | null {
  if (!value || typeof value !== "string") return null;
  if (!/^(?:https?:|data:|blob:)/i.test(value)) {
    return value.replace(/^\/+/, ""); // already a bare path
  }
  const m = value.match(STORAGE_URL_RE);
  if (!m) return null; // external URL we can't sign
  const [, bucket, rest] = m;
  if (bucket !== BUCKET) return null;
  return decodeURIComponent(rest.split("?")[0]);
}

function collect(set: Set<string>, value: unknown) {
  const p = normalizePath(value);
  if (p) set.add(p);
}

const EVENT_BRANDING_SELECT = "id, logo_url, back_template_url, sponsor_logos";

// Server-side mirror of VerifyAccreditation's accreditation lookup.
async function fetchAccreditation(id: string) {
  const cleanId = id.includes("ACC-") ? id.split("-").pop()! : id;
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const isUUID = uuidRe.test(id) || uuidRe.test(cleanId);
  const select = `*, events:event_id(${EVENT_BRANDING_SELECT})`;

  if (isUUID) {
    const uuid = id.length === 36 ? id : cleanId;
    const { data } = await supabase.from("accreditations").select(select).eq("id", uuid).maybeSingle();
    if (data) return data;
  }

  const filters = [`accreditation_id.eq.${id}`, `badge_number.eq.${id}`];
  if (id !== cleanId) {
    filters.push(`accreditation_id.eq.${cleanId}`, `badge_number.eq.${cleanId}`);
  }
  const { data } = await supabase.from("accreditations").select(select).or(filters.join(",")).maybeSingle();
  return data || null;
}

function addEventBranding(set: Set<string>, eventRow: Record<string, unknown> | null | undefined) {
  if (!eventRow) return;
  collect(set, eventRow.logo_url);
  collect(set, eventRow.back_template_url);
  const sponsors = Array.isArray(eventRow.sponsor_logos) ? eventRow.sponsor_logos : [];
  for (const s of sponsors) collect(set, s);
}

async function addEventDocs(set: Set<string>, eventId: string) {
  const keys = [
    `event_${eventId}_official_docs`,
    `event_${eventId}_technical_docs`,
    `event_${eventId}_safety_docs`,
  ];
  const { data } = await supabase.from("global_settings").select("key, value").in("key", keys);
  for (const row of data || []) {
    try {
      const arr = JSON.parse((row as { value: string }).value);
      if (Array.isArray(arr)) for (const d of arr) collect(set, d?.url);
    } catch {
      /* malformed setting — skip */
    }
  }
}

async function addBroadcastAttachments(set: Set<string>, eventId: string) {
  const { data } = await supabase
    .from("broadcasts_v2")
    .select("attachment_url")
    .eq("event_id", eventId)
    .is("deleted_at", null)
    .not("attachment_url", "is", null);
  for (const row of data || []) collect(set, (row as { attachment_url: string }).attachment_url);
}

async function addGallery(set: Set<string>, eventId: string) {
  const { data } = await supabase
    .from("event_photos")
    .select("url, thumbnail_url")
    .eq("event_id", eventId)
    .eq("is_public", true);
  for (const row of data || []) {
    const r = row as { url: string; thumbnail_url: string };
    collect(set, r.url);
    collect(set, r.thumbnail_url);
  }
}

async function addLiveTeamLogos(set: Set<string>, eventId: string) {
  const { data } = await supabase
    .from("live_score_matches")
    .select("team_a_logo_url, team_b_logo_url")
    .eq("event_id", eventId);
  for (const row of data || []) {
    const r = row as { team_a_logo_url: string; team_b_logo_url: string };
    collect(set, r.team_a_logo_url);
    collect(set, r.team_b_logo_url);
  }
}

serve(async (req: Request) => {
  const headers = corsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, headers);

  try {
    const body = await req.json().catch(() => ({}));
    const { accreditationId, eventId, scope = "profile", paths, expiresIn } = body ?? {};

    if (!Array.isArray(paths) || paths.length === 0) return json({ urls: {} }, 200, headers);
    if (paths.length > MAX_PATHS) return json({ error: "Too many paths" }, 400, headers);

    const ttl = Math.min(Math.max(Number(expiresIn) || DEFAULT_EXPIRY, MIN_EXPIRY), MAX_EXPIRY);

    // Build the data-derived allowlist for the requested scope.
    const allow = new Set<string>();

    if (scope === "profile") {
      if (!isValidId(accreditationId)) return json({ error: "Invalid accreditationId" }, 400, headers);
      const acc = await fetchAccreditation(accreditationId);
      if (!acc) return json({ urls: {} }, 200, headers); // unknown id -> sign nothing
      collect(allow, (acc as Record<string, unknown>).photo_url);
      collect(allow, (acc as Record<string, unknown>).heat_sheet_url);
      collect(allow, (acc as Record<string, unknown>).event_result_url);
      addEventBranding(allow, (acc as Record<string, unknown>).events as Record<string, unknown>);
      const accEventId = (acc as Record<string, unknown>).event_id;
      if (typeof accEventId === "string" && accEventId) {
        await addEventDocs(allow, accEventId);
        await addBroadcastAttachments(allow, accEventId);
      }
    } else if (scope === "branding") {
      if (!isValidId(eventId)) return json({ error: "Invalid eventId" }, 400, headers);
      const { data: ev } = await supabase.from("events").select(EVENT_BRANDING_SELECT).eq("id", eventId).maybeSingle();
      addEventBranding(allow, ev as Record<string, unknown> | null);
    } else if (scope === "gallery") {
      if (!isValidId(eventId)) return json({ error: "Invalid eventId" }, 400, headers);
      await addGallery(allow, eventId);
    } else if (scope === "live") {
      if (!isValidId(eventId)) return json({ error: "Invalid eventId" }, 400, headers);
      await addLiveTeamLogos(allow, eventId);
    } else {
      return json({ error: "Unknown scope" }, 400, headers);
    }

    // Sign only requested paths that the allowlist actually contains.
    const wanted = [...new Set(paths.map(normalizePath).filter((p): p is string => Boolean(p)))].filter((p) =>
      allow.has(p)
    );

    const urls: Record<string, string> = {};
    if (wanted.length) {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrls(wanted, ttl);
      for (const item of signed || []) {
        if (item.signedUrl && !item.error) urls[item.path] = item.signedUrl;
      }
    }

    return json({ urls }, 200, headers);
  } catch (err) {
    console.error("public-verify-assets error:", (err as Error).message);
    return json({ error: "Internal Server Error" }, 500, headers);
  }
});
