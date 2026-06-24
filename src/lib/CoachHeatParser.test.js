import { describe, it, expect } from "vitest";
import {
  parseGenderFromEvent,
  parseAgeCatFromEvent,
  normalizeTeam,
  calculateAge,
  normalizeName,
  matchAthleteEvents,
} from "./CoachHeatParser";

// Pure-logic coverage for the Hy-Tek heat-sheet parser and the athlete-matching
// engine. These functions drive medal rankings / start lists, so a silent
// regression here mis-assigns swimmers — high-value to lock down. No file I/O is
// exercised (the PDF/Excel/HTML readers are intentionally not imported here).

describe("parseGenderFromEvent", () => {
  it("maps girls/women/female to Female", () => {
    expect(parseGenderFromEvent("Girls 12 & Over 100 Free")).toBe("Female");
    expect(parseGenderFromEvent("Women 200 IM")).toBe("Female");
    expect(parseGenderFromEvent("Female 50 Fly")).toBe("Female");
  });

  it("maps boys/men/male to Male", () => {
    expect(parseGenderFromEvent("Boys 13-14 200 Back")).toBe("Male");
    expect(parseGenderFromEvent("Men 400 Free")).toBe("Male");
    expect(parseGenderFromEvent("Male 100 Breast")).toBe("Male");
  });

  it("defaults to Mixed for unknown or empty titles", () => {
    expect(parseGenderFromEvent("Mixed 4x100 Relay")).toBe("Mixed");
    expect(parseGenderFromEvent("200 Freestyle")).toBe("Mixed");
    expect(parseGenderFromEvent("")).toBe("Mixed");
    expect(parseGenderFromEvent(null)).toBe("Mixed");
  });
});

describe("parseAgeCatFromEvent", () => {
  it("extracts '& Over' / '& Under' bands", () => {
    expect(parseAgeCatFromEvent("Girls 12 & Over 1500 Free")).toBe("12 & Over");
    expect(parseAgeCatFromEvent("Boys 10 & Under 50 Fly")).toBe("10 & Under");
  });

  it("extracts numeric ranges and year forms", () => {
    expect(parseAgeCatFromEvent("Boys 13-14 200 Back")).toBe("13-14");
    expect(parseAgeCatFromEvent("Girls 9 Year 100 Free")).toBe("9 Year");
  });

  it("defaults to Open when no age band is present", () => {
    expect(parseAgeCatFromEvent("Open 200 IM")).toBe("Open");
    expect(parseAgeCatFromEvent("")).toBe("Open");
    expect(parseAgeCatFromEvent(null)).toBe("Open");
  });
});

describe("normalizeTeam", () => {
  it("strips a trailing country/region code and lowercases", () => {
    expect(normalizeTeam("Dolphins (UAE)")).toBe("dolphins");
    expect(normalizeTeam("Sharks SC (KSA)")).toBe("sharks sc");
  });

  it("trims whitespace and tolerates empty input", () => {
    expect(normalizeTeam("  Marlins  ")).toBe("marlins");
    expect(normalizeTeam("")).toBe("");
    expect(normalizeTeam(null)).toBe("");
  });
});

describe("calculateAge", () => {
  const yearsAgo = (years, monthOffset = 0, dayOffset = 0) => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - years);
    d.setMonth(d.getMonth() + monthOffset);
    d.setDate(d.getDate() + dayOffset);
    return d.toISOString().split("T")[0];
  };

  it("returns null for missing input", () => {
    expect(calculateAge(null)).toBe(null);
    expect(calculateAge("")).toBe(null);
  });

  it("computes whole years for a birthday already passed this year", () => {
    // born 20 years ago, one month earlier in the calendar -> birthday passed
    expect(calculateAge(yearsAgo(20, -1))).toBe(20);
  });

  it("does not count a birthday that has not occurred yet this year", () => {
    // born 20 years ago but one month in the future -> still 19
    expect(calculateAge(yearsAgo(20, 1))).toBe(19);
  });
});

describe("normalizeName", () => {
  it("trims and lowercases without altering interior tokens by default", () => {
    expect(normalizeName("  John Doe ")).toBe("john doe");
  });

  it("keeps only first + last when stripMiddle is set", () => {
    expect(normalizeName("John Michael Doe", true)).toBe("john doe");
    expect(normalizeName("Maria De La Cruz", true)).toBe("maria cruz");
  });

  it("returns the single token unchanged under stripMiddle", () => {
    expect(normalizeName("Madonna", true)).toBe("madonna");
    expect(normalizeName(null)).toBe("");
  });
});

describe("matchAthleteEvents", () => {
  const accreditations = [
    { id: "a1", name: "John Smith", gender: "Male", club_name: "Dolphins", age: 12 },
    { id: "a2", name: "Sara Khan", gender: "Female", club_name: "Marlins", age: 14 },
  ];

  it("matches a swimmer by name tokens, club, and age and returns the DB id", async () => {
    const rows = [
      {
        athleteName: "John Smith",
        gender: "Male",
        teamName: "Dolphins",
        age: 12,
        eventCode: "101",
        eventName: "Boys 12 & Over 100 Free",
        heat: 1,
        lane: 4,
        seedTime: "1:02.34",
      },
    ];
    const out = await matchAthleteEvents(rows, accreditations);
    expect(out).toHaveLength(1);
    expect(out[0].accreditation_id).toBe("a1");
    expect(out[0].round).toBe("Finals");
    expect(out[0].matched).toBe(true);
  });

  it("classifies prelim events into the Prelims round", async () => {
    const rows = [
      { athleteName: "Sara Khan", gender: "Female", teamName: "Marlins", age: 14, eventCode: "201", eventName: "Girls 200 IM Prelim" },
    ];
    const out = await matchAthleteEvents(rows, accreditations);
    expect(out).toHaveLength(1);
    expect(out[0].round).toBe("Prelims");
  });

  it("does not match across a locked gender even when the name is identical", async () => {
    const rows = [
      { athleteName: "John Smith", gender: "Female", teamName: "Dolphins", age: 12, eventCode: "101", eventName: "Girls 100 Free" },
    ];
    const out = await matchAthleteEvents(rows, accreditations);
    expect(out).toHaveLength(0);
  });

  it("returns no match for an unknown athlete", async () => {
    const rows = [
      { athleteName: "Zzz Qqq", gender: "Male", teamName: "Unknown", age: 30, eventCode: "101", eventName: "Boys 100 Free" },
    ];
    const out = await matchAthleteEvents(rows, accreditations);
    expect(out).toHaveLength(0);
  });

  it("deduplicates repeated rows for the same athlete/event/round", async () => {
    const base = { athleteName: "John Smith", gender: "Male", teamName: "Dolphins", age: 12, eventCode: "101", eventName: "Boys 100 Free" };
    const out = await matchAthleteEvents([base, { ...base, heat: 2 }], accreditations);
    expect(out).toHaveLength(1);
  });

  it("skips rows with no athlete name", async () => {
    const out = await matchAthleteEvents([{ athleteName: "", gender: "Male", eventCode: "101", eventName: "x" }], accreditations);
    expect(out).toHaveLength(0);
  });
});
