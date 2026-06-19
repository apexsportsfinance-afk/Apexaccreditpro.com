import { describe, it, expect } from "vitest";
import { getStatFieldsForSport, getSportStatLabel } from "./sportStatFields";

describe("getStatFieldsForSport", () => {
  it("returns basketball fields for 'basketball'", () => {
    const f = getStatFieldsForSport("basketball");
    expect(f.map((x) => x.key)).toEqual(["points", "three_pointers", "rebounds", "assists", "fouls"]);
  });

  it("returns volleyball fields for 'volleyball'", () => {
    const f = getStatFieldsForSport("volleyball");
    expect(f.map((x) => x.key)).toContain("aces");
    expect(f).toHaveLength(6);
  });

  it("defaults to football fields for '' / unknown / null / undefined", () => {
    const footballKeys = ["goals", "assists", "yellow_cards", "red_cards"];
    for (const v of ["", "football", "cricket", null, undefined]) {
      expect(getStatFieldsForSport(v).map((x) => x.key)).toEqual(footballKeys);
    }
  });

  it("is case-sensitive (only exact lowercase matches the special sports)", () => {
    // Non-exact casing falls through to the football default.
    expect(getStatFieldsForSport("Basketball")).toEqual(getStatFieldsForSport(""));
  });

  it("every field exposes key/label/short", () => {
    for (const sport of ["basketball", "volleyball", ""]) {
      for (const field of getStatFieldsForSport(sport)) {
        expect(field).toEqual(
          expect.objectContaining({ key: expect.any(String), label: expect.any(String), short: expect.any(String) })
        );
      }
    }
  });
});

describe("getSportStatLabel", () => {
  it("maps known sports", () => {
    expect(getSportStatLabel("basketball")).toBe("Basketball");
    expect(getSportStatLabel("volleyball")).toBe("Volleyball");
  });
  it("defaults to Football", () => {
    for (const v of ["", "rugby", null, undefined]) {
      expect(getSportStatLabel(v)).toBe("Football");
    }
  });
});
