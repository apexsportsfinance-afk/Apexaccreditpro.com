#!/usr/bin/env node
// ============================================================
// ApexAccreditPro — STAGING storage test-file uploader (idempotent)
// ============================================================
// The staging seed (seed-staging.mjs) writes fake DB rows but NO storage files,
// so the private-bucket soak (Step C) has nothing to sign. This uploads a tiny
// set of obviously-fake test assets to the `accreditation-files` bucket and
// points the first seeded event + accreditation at them, so the
// public-verify-assets edge function has real objects to issue signed URLs for.
//
// Covers the soak's core render paths:
//   - accreditation.photo_url  -> profile scope (Verify photo, Scanner, cards)
//   - accreditation.heat_sheet_url / event_result_url -> profile PDF downloads
//   - event.logo_url / back_template_url / sponsor_logos -> branding + cards
//   - event_photos (is_public) -> gallery scope (best-effort)
//
// USAGE (PowerShell, repo root):
//   $env:STAGING_SERVICE_ROLE_KEY = "<staging service_role JWT>"
//   node scripts/upload-staging-test-files.mjs
//
// The service_role key is SECRET — env var only, never commit, never in
// .env.staging (that file is baked into the public bundle).
//
// RULES: fake data only; refuses to run against LIVE; idempotent (upsert).
// ============================================================

import { createClient } from "@supabase/supabase-js";

const STAGING_URL =
  process.env.STAGING_SUPABASE_URL || "https://bieqfzwljxkmmldmlzyb.supabase.co";
const SERVICE_ROLE_KEY = process.env.STAGING_SERVICE_ROLE_KEY;
const LIVE_REF = "dixelomafeobabahqeqg"; // NEVER touch this one
const BUCKET = "accreditation-files";
const PREFIX = "staging-test"; // all test objects live under this folder

// --- Isolation guard (identical contract to seed-staging.mjs) -----------
if (!SERVICE_ROLE_KEY) {
  console.error("ERROR: set STAGING_SERVICE_ROLE_KEY (staging Settings -> API -> service_role).");
  process.exit(1);
}
if (STAGING_URL.includes(LIVE_REF)) {
  console.error(`REFUSING: ${STAGING_URL} is the LIVE project.`);
  process.exit(1);
}
try {
  const payload = JSON.parse(Buffer.from(SERVICE_ROLE_KEY.split(".")[1], "base64").toString("utf8"));
  if (payload.ref === LIVE_REF) {
    console.error("REFUSING: the service_role key belongs to the LIVE project.");
    process.exit(1);
  }
  if (!STAGING_URL.includes(payload.ref)) {
    console.error(`REFUSING: key ref "${payload.ref}" does not match URL "${STAGING_URL}".`);
    process.exit(1);
  }
  if (payload.role !== "service_role") {
    console.error(`REFUSING: key role is "${payload.role}", expected service_role.`);
    process.exit(1);
  }
} catch (e) {
  console.error("REFUSING: could not parse the service_role JWT.", e.message);
  process.exit(1);
}

const supabase = createClient(STAGING_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// --- Tiny fake assets (decoded from base64) -----------------------------
// 1x1 PNGs in distinct colours so each test surface is visually distinguishable.
const png = (b64) => Buffer.from(b64, "base64");
const RED_PX = png("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");
const BLUE_PX = png("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwAEhgGAVHIc9wAAAABJRU5ErkJggg==");
const GREEN_PX = png("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==");
const GREY_PX = png("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==");
// Minimal PDF (pdf.js / browser viewers rebuild the xref, so this opens fine).
const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n" +
    "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 144]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n" +
    "4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n" +
    "5 0 obj<</Length 44>>stream\nBT /F1 16 Tf 18 90 Td (Apex staging test) Tj ET\nendstream endobj\n" +
    "trailer<</Root 1 0 R>>\n%%EOF",
  "utf8"
);

const FILES = [
  { path: `${PREFIX}/photo.png`, body: RED_PX, contentType: "image/png" },
  { path: `${PREFIX}/logo.png`, body: BLUE_PX, contentType: "image/png" },
  { path: `${PREFIX}/back-template.png`, body: GREY_PX, contentType: "image/png" },
  { path: `${PREFIX}/sponsor.png`, body: GREEN_PX, contentType: "image/png" },
  { path: `${PREFIX}/gallery-1.png`, body: GREEN_PX, contentType: "image/png" },
  { path: `${PREFIX}/heat-sheet.pdf`, body: PDF, contentType: "application/pdf" },
  { path: `${PREFIX}/result.pdf`, body: PDF, contentType: "application/pdf" },
];

async function uploadAll() {
  for (const f of FILES) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(f.path, f.body, { contentType: f.contentType, upsert: true });
    if (error) throw new Error(`upload ${f.path}: ${error.message}`);
    console.log(`  uploaded ${BUCKET}/${f.path}`);
  }
}

async function patchRows() {
  // Point the first seeded event at the branding test files.
  const { data: ev } = await supabase
    .from("events")
    .select("id, name")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (ev) {
    const { error } = await supabase
      .from("events")
      .update({
        logo_url: `${PREFIX}/logo.png`,
        back_template_url: `${PREFIX}/back-template.png`,
        sponsor_logos: [`${PREFIX}/sponsor.png`],
      })
      .eq("id", ev.id);
    if (error) throw new Error(`patch event: ${error.message}`);
    console.log(`  event "${ev.name}" -> logo/back/sponsor wired`);

    // Gallery scope (best-effort: column set may differ on staging).
    const { error: gErr } = await supabase
      .from("event_photos")
      .upsert(
        {
          id: "00000000-0000-4000-8000-0000000a1b1e",
          event_id: ev.id,
          url: `${PREFIX}/gallery-1.png`,
          thumbnail_url: `${PREFIX}/gallery-1.png`,
          is_public: true,
          title: "Staging Test Photo",
          album_name: "Staging Test",
        },
        { onConflict: "id" }
      );
    if (gErr) console.warn(`  (gallery row skipped: ${gErr.message} — wire manually if testing gallery scope)`);
    else console.log("  event_photos gallery row wired");
  } else {
    console.warn("  no event found — run seed-staging.mjs first");
  }

  // Point the first seeded accreditation at the photo + PDFs.
  const { data: acc } = await supabase
    .from("accreditations")
    .select("id, name")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (acc) {
    const { error } = await supabase
      .from("accreditations")
      .update({
        photo_url: `${PREFIX}/photo.png`,
        heat_sheet_url: `${PREFIX}/heat-sheet.pdf`,
        event_result_url: `${PREFIX}/result.pdf`,
      })
      .eq("id", acc.id);
    if (error) throw new Error(`patch accreditation: ${error.message}`);
    console.log(`  accreditation "${acc.name}" (${acc.id}) -> photo/heat/result wired`);
    console.log(`\n  ► Soak this record at: /verify/${acc.id}`);
  } else {
    console.warn("  no accreditation found — run seed-staging.mjs first");
  }
}

(async () => {
  console.log(`Uploading staging test files to ${STAGING_URL} (${BUCKET}/${PREFIX}/) ...`);
  await uploadAll();
  await patchRows();
  console.log("\nDone. Re-run anytime (idempotent).");
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
