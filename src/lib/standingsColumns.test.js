import { describe, it, expect } from "vitest";
import {
  getStandingsColumns,
  getStandingsLegend,
  STANDINGS_TYPE_OPTIONS,
} from "./standingsColumns";

describe("getStandingsColumns", () => {
  it("returns the football/default columns for empty or unknown types", () => {
    const def = getStandingsColumns("");
    const unknown = getStandingsColumns("kabaddi");
    expect(def).toBe(unknown); // both fall through to the same FOOTBALL_COLUMNS
    expect(def.map((c) => c.header)).toEqual(["P", "W", "D", "L", "GF", "GA", "GD", "PTS"]);
    // points is the highlighted ranking column
    expect(def.find((c) => c.highlight)?.key).toBe("points");
  });

  it("returns basketball columns with a win% formatter and no draws", () => {
    const cols = getStandingsColumns("basketball");
    expect(cols.map((c) => c.key)).not.toContain("drawn");
    const winPct = cols.find((c) => c.key === "win_pct");
    expect(winPct?.highlight).toBe(true);
    expect(winPct?.format(0.5)).toBe("50%");
    expect(winPct?.format(undefined)).toBe("0%");
    const diff = cols.find((c) => c.key === "goal_diff");
    expect(diff?.format(3)).toBe("+3");
    expect(diff?.format(-2)).toBe("-2");
  });

  it("returns volleyball columns with a set-ratio formatter", () => {
    const cols = getStandingsColumns("volleyball");
    const ratio = cols.find((c) => c.key === "set_ratio");
    expect(ratio?.format(1.5)).toBe("1.50");
    expect(ratio?.format(null)).toBe("0.00");
    expect(cols.find((c) => c.highlight)?.key).toBe("points");
  });
});

describe("getStandingsLegend", () => {
  it("returns the sport-specific legend and falls back to football", () => {
    expect(getStandingsLegend("basketball")).toMatch(/Win %/);
    expect(getStandingsLegend("volleyball")).toMatch(/Set Ratio/);
    expect(getStandingsLegend("")).toBe(getStandingsLegend("anything-else"));
    expect(getStandingsLegend("")).toMatch(/GD = Goal\/Point Difference/);
  });
});

describe("STANDINGS_TYPE_OPTIONS", () => {
  it("exposes the three selectable standings types", () => {
    expect(STANDINGS_TYPE_OPTIONS.map((o) => o.value)).toEqual(["", "basketball", "volleyball"]);
  });
});
