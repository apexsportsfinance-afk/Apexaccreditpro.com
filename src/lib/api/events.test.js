import { describe, it, expect, vi } from "vitest";

// The mappers are pure, but events.js (and its audit import) pull in the
// supabase client at module load — stub it so no real credentials are needed.
vi.mock("../supabase", () => ({ supabase: {} }));

import { mapEventToDB, mapEventFromDB } from "./events";

describe("mapEventToDB", () => {
  it("maps camelCase app fields to snake_case columns", () => {
    const db = mapEventToDB({
      name: "Cup",
      startDate: "2026-01-01",
      logoUrl: "logo.png",
      backTemplateUrl: "back.png",
      sponsorLogos: ["a.png"],
      registrationClosedMessage: "closed",
    });
    expect(db).toMatchObject({
      name: "Cup",
      start_date: "2026-01-01",
      logo_url: "logo.png",
      back_template_url: "back.png",
      sponsor_logos: ["a.png"],
      athlete_qr_broadcast_message: "closed",
    });
  });

  it("omits fields that are undefined (partial updates)", () => {
    const db = mapEventToDB({ name: "Only" });
    expect(db).toEqual({ name: "Only" });
    expect("logo_url" in db).toBe(false);
  });

  it("encodes outputType into description with the |||OT: marker", () => {
    expect(mapEventToDB({ description: "Hello", outputType: "Membership Card" }).description).toBe(
      "Hello|||OT:Membership Card"
    );
  });

  it("defaults outputType to 'Accreditation Pass' when only description is set", () => {
    expect(mapEventToDB({ description: "Hi" }).description).toBe("Hi|||OT:Accreditation Pass");
  });

  it("does not emit a description key when neither description nor outputType is provided", () => {
    expect("description" in mapEventToDB({ name: "X" })).toBe(false);
  });
});

describe("mapEventFromDB", () => {
  it("returns null for a null row", () => {
    expect(mapEventFromDB(null)).toBe(null);
  });

  it("decodes the |||OT: marker back into description + outputType", () => {
    const ev = mapEventFromDB({ id: "1", description: "Hello|||OT:Membership Card" });
    expect(ev.description).toBe("Hello");
    expect(ev.outputType).toBe("Membership Card");
  });

  it("treats a marker-less description as plain text with the default outputType", () => {
    const ev = mapEventFromDB({ id: "1", description: "Just text" });
    expect(ev.description).toBe("Just text");
    expect(ev.outputType).toBe("Accreditation Pass");
  });

  it("applies safe defaults for nullable columns", () => {
    const ev = mapEventFromDB({ id: "1" });
    expect(ev.sponsorLogos).toEqual([]);
    expect(ev.requiredDocuments).toEqual(["picture", "passport"]);
    expect(ev.termsAndConditions).toBe("");
    expect(ev.timezone).toBe("UTC");
    expect(ev.sportList).toEqual([]);
    expect(ev.registrationClosedMessage).toBe("");
  });

  it("maps snake_case columns back to camelCase", () => {
    const ev = mapEventFromDB({ id: "1", logo_url: "l.png", back_template_url: "b.png", start_date: "2026-02-02" });
    expect(ev).toMatchObject({ logoUrl: "l.png", backTemplateUrl: "b.png", startDate: "2026-02-02" });
  });
});

describe("description round-trip (to -> from)", () => {
  it("preserves description + outputType across encode/decode", () => {
    const db = mapEventToDB({ description: "Round trip", outputType: "Membership Card" });
    const back = mapEventFromDB({ id: "1", description: db.description });
    expect(back.description).toBe("Round trip");
    expect(back.outputType).toBe("Membership Card");
  });
});
