#!/usr/bin/env node
// ============================================================
// ApexAccreditPro — STAGING fake-data seeder (idempotent)
// ============================================================
// Seeds the ISOLATED staging Supabase project with a test admin login plus a
// handful of OBVIOUSLY-FAKE events / zones / categories / teams / accreditations,
// so the UI has something to render and flows can be clicked through.
//
// Why a script (not seed.sql): creating an auth user is version-sensitive
// (auth.users + auth.identities internals drift across GoTrue releases). The
// Supabase Admin API does it correctly regardless of version. The same
// service_role client then writes the public rows, bypassing RLS.
//
// USAGE (PowerShell, from the repo root):
//   $env:STAGING_SERVICE_ROLE_KEY = "<staging service_role JWT>"   # Settings -> API
//   node scripts/seed-staging.mjs
//
// The service_role key is SECRET — never commit it, never put it in .env.staging
// (that file is baked into the public bundle). It is read from the env var only.
//
// RULES:
//   * FAKE data only — no real athlete names, photos, IDs, or PII.
//   * Refuses to run against the LIVE project (hard ref guard below).
//   * Idempotent: fixed UUIDs + upserts, safe to re-run.
// ============================================================

import { createClient } from "@supabase/supabase-js";

// --- Config -------------------------------------------------------------
const STAGING_URL =
  process.env.STAGING_SUPABASE_URL || "https://bieqfzwljxkmmldmlzyb.supabase.co";
const SERVICE_ROLE_KEY = process.env.STAGING_SERVICE_ROLE_KEY;
const LIVE_REF = "dixelomafeobabahqeqg"; // NEVER seed this one

const ADMIN_EMAIL = process.env.STAGING_ADMIN_EMAIL || "staging-admin@example.com";
const ADMIN_PASSWORD = process.env.STAGING_ADMIN_PASSWORD || "StagingAdmin2026!";

// --- Isolation guard ----------------------------------------------------
if (!SERVICE_ROLE_KEY) {
  console.error(
    "ERROR: set STAGING_SERVICE_ROLE_KEY (staging Settings -> API -> service_role) before running."
  );
  process.exit(1);
}
if (STAGING_URL.includes(LIVE_REF)) {
  console.error(`REFUSING: ${STAGING_URL} is the LIVE project. Seed staging only.`);
  process.exit(1);
}
// The service_role JWT embeds the project ref in its payload — verify it matches
// the URL and is NOT live, so a mismatched key can't write to the wrong project.
try {
  const payload = JSON.parse(
    Buffer.from(SERVICE_ROLE_KEY.split(".")[1], "base64").toString("utf8")
  );
  if (payload.ref === LIVE_REF) {
    console.error("REFUSING: the service_role key belongs to the LIVE project.");
    process.exit(1);
  }
  if (!STAGING_URL.includes(payload.ref)) {
    console.error(
      `REFUSING: key ref "${payload.ref}" does not match URL "${STAGING_URL}".`
    );
    process.exit(1);
  }
  if (payload.role !== "service_role") {
    console.error(`REFUSING: key role is "${payload.role}", expected service_role.`);
    process.exit(1);
  }
} catch {
  console.error("REFUSING: could not parse the service_role JWT.");
  process.exit(1);
}

const db = createClient(STAGING_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// --- Fixed UUIDs (idempotency) -----------------------------------------
const EV1 = "5ad17e00-0000-4000-a000-000000000001"; // Test Cup
const EV2 = "5ad17e00-0000-4000-a000-000000000002"; // Demo League

const must = (label, { error }) => {
  if (error) {
    console.error(`  ✗ ${label}: ${error.message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${label}`);
};

async function seedAdminUser() {
  console.log("Admin user:");
  // createUser is idempotent-friendly: if the email exists it errors, which we
  // tolerate, then look the id up so we can (re)assert the profile role.
  const { data: created, error: createErr } = await db.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { role: "super_admin", full_name: "Staging Admin" },
  });

  let userId = created?.user?.id;
  if (createErr) {
    if (!/already|registered|exists/i.test(createErr.message)) {
      console.error(`  ✗ createUser: ${createErr.message}`);
      process.exit(1);
    }
    // Already there — find the id by paging users.
    const { data: list, error: listErr } = await db.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) must("listUsers", { error: listErr });
    userId = list.users.find((u) => u.email === ADMIN_EMAIL)?.id;
    console.log(`  ✓ exists (${ADMIN_EMAIL})`);
  } else {
    console.log(`  ✓ created (${ADMIN_EMAIL} / ${ADMIN_PASSWORD})`);
  }

  if (!userId) {
    console.error("  ✗ could not resolve admin user id");
    process.exit(1);
  }
  // profiles.role is the trusted source post-login — assert super_admin.
  must(
    "profile super_admin",
    await db.from("profiles").upsert(
      {
        id: userId,
        email: ADMIN_EMAIL,
        full_name: "Staging Admin",
        role: "super_admin",
      },
      { onConflict: "id" }
    )
  );
  return userId;
}

async function seedPublicData(adminId) {
  console.log("Events:");
  must(
    "events",
    await db.from("events").upsert(
      [
        {
          id: EV1,
          slug: "staging-test-cup-2026",
          name: "STAGING — Test Cup 2026",
          description: "Fake event for staging click-through. Not real.",
          start_date: "2026-07-01",
          end_date: "2026-07-05",
          location: "Staging Arena, Dubai",
          registration_open: true,
          timezone: "Asia/Dubai",
        },
        {
          id: EV2,
          slug: "staging-demo-league",
          name: "STAGING — Demo League",
          description: "Fake event for staging click-through. Not real.",
          start_date: "2026-08-10",
          end_date: "2026-08-12",
          location: "Demo Stadium, Dubai",
          registration_open: true,
          timezone: "Asia/Dubai",
        },
      ],
      { onConflict: "id" }
    )
  );

  console.log("Zones:");
  const zoneRows = [EV1, EV2].flatMap((eventId) => [
    { event_id: eventId, code: "FOP", name: "Field of Play", color: "#16a34a", allowed_roles: ["Athlete", "Official"] },
    { event_id: eventId, code: "MED", name: "Media Tribune", color: "#2563eb", allowed_roles: ["Media"] },
    { event_id: eventId, code: "VIP", name: "VIP Lounge", color: "#9333ea", allowed_roles: [] },
    { event_id: eventId, code: "OPS", name: "Operations", color: "#ea580c", allowed_roles: ["Official", "Staff"] },
  ]);
  // zones has no fixed id here; clear staging zones for these events first so
  // re-runs don't duplicate (no natural unique key guaranteed on event_id+code).
  must("clear zones", await db.from("zones").delete().in("event_id", [EV1, EV2]));
  must("zones", await db.from("zones").insert(zoneRows));

  console.log("Categories:");
  must(
    "categories",
    await db.from("categories").upsert(
      [
        { name: "Athlete", slug: "staging-athlete", badge_color: "#16a34a", badge_prefix: "ATH" },
        { name: "Coach", slug: "staging-coach", badge_color: "#2563eb", badge_prefix: "COA" },
        { name: "Official", slug: "staging-official", badge_color: "#ea580c", badge_prefix: "OFF" },
        { name: "Media", slug: "staging-media", badge_color: "#9333ea", badge_prefix: "MED" },
      ],
      { onConflict: "slug" }
    )
  );

  console.log("Teams:");
  must("clear teams", await db.from("teams").delete().in("event_id", [EV1, EV2]));
  must(
    "teams",
    await db.from("teams").insert([
      { event_id: EV1, name: "STAGING FC", short_name: "SFC", country: "AE", city: "Dubai", status: "approved", contact_name: "Test Manager", contact_email: "manager@example.com" },
      { event_id: EV1, name: "Demo Athletics Club", short_name: "DAC", country: "AE", city: "Abu Dhabi", status: "pending", contact_name: "Demo Lead", contact_email: "lead@example.com" },
      { event_id: EV2, name: "Sample United", short_name: "SU", country: "AE", city: "Sharjah", status: "approved", contact_name: "Sample Coord", contact_email: "coord@example.com" },
    ])
  );

  console.log("Accreditations:");
  const statuses = ["approved", "pending", "approved", "rejected", "approved"];
  const roles = ["Athlete", "Coach", "Official", "Media", "Athlete"];
  const zoneByRole = { Athlete: "FOP", Coach: "FOP", Official: "OPS", Media: "MED" };
  const accRows = [EV1, EV2].flatMap((eventId, ei) =>
    Array.from({ length: 5 }, (_, i) => {
      const role = roles[i];
      return {
        event_id: eventId,
        first_name: "Test",
        last_name: `Person ${ei + 1}-${i + 1}`,
        gender: i % 2 === 0 ? "M" : "F",
        date_of_birth: `199${i}-0${(i % 9) + 1}-15`,
        nationality: "AE",
        club: ei === 0 ? "STAGING FC" : "Sample United",
        role,
        email: `test.person.${ei + 1}.${i + 1}@example.com`,
        status: statuses[i],
        zone_code: zoneByRole[role] || "OPS",
        badge_number: `STG-${ei + 1}${i + 1}`,
        badge_color: "#2563eb",
        created_by: adminId,
        remarks: "STAGING fake record",
      };
    })
  );
  must("clear accreditations", await db.from("accreditations").delete().in("event_id", [EV1, EV2]));
  must("accreditations", await db.from("accreditations").insert(accRows));
}

(async () => {
  console.log(`Seeding STAGING → ${STAGING_URL}\n`);
  const adminId = await seedAdminUser();
  await seedPublicData(adminId);
  console.log("\nDone. Log in at https://apex-staging-2ft.pages.dev with:");
  console.log(`  ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  console.log("\nPre-flight: confirm every Supabase request hits bieqfzwljxkmmldmlzyb.supabase.co (never the live ref).");
})();
