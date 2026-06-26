import { describe, it, expect } from "vitest";
import { parseFeederRef, labelBase, bracketSection, layoutSection, computeStandings } from "./fixtureChart";
import { generateSingleElimination, generateDoubleElimination } from "./fixtureGenerators";

// The layout consumes DB-shaped rows (match_title / team_a_name / team_b_name /
// stage). The generators return that shape directly, so we can feed them in.
const teams = (n) => Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, name: `Team ${i + 1}` }));

describe("parseFeederRef", () => {
  it("extracts the feeder match title from Winner/Loser placeholders", () => {
    expect(parseFeederRef("Winner of Semifinal 1")).toBe("Semifinal 1");
    expect(parseFeederRef("Loser of Quarterfinal 2")).toBe("Quarterfinal 2");
  });
  it("returns null for real teams and group placeholders", () => {
    expect(parseFeederRef("Team 5")).toBeNull();
    expect(parseFeederRef("1st - Group A")).toBeNull();
  });
});

describe("labelBase", () => {
  it("strips index suffixes and WB prefix but keeps round names", () => {
    expect(labelBase("Semifinal 1")).toBe("Semifinal");
    expect(labelBase("WB Quarterfinal 2")).toBe("Quarterfinal");
    expect(labelBase("Round of 16 3")).toBe("Round of 16");
    expect(labelBase("LB Round 2 - Match 1")).toBe("LB Round 2");
    expect(labelBase("Final")).toBe("Final");
  });
});

describe("layoutSection — single elimination (8 teams)", () => {
  const matches = generateSingleElimination(teams(8));

  it("places the final in the rightmost column and round 1 leftmost", () => {
    const { matches: laid, maxRound } = layoutSection(matches);
    const final = laid.find((m) => m.match_title === "Final");
    const quarters = laid.filter((m) => /Quarterfinal/.test(m.match_title));
    expect(final.__round).toBe(maxRound); // final on the right
    quarters.forEach((q) => expect(q.__round).toBe(0)); // first round on the left
  });

  it("assigns a column per round (QF=0, SF=1, F=2)", () => {
    const { matches: laid } = layoutSection(matches);
    const round = (title) => laid.find((m) => m.match_title === title).__round;
    expect(round("Semifinal 1")).toBe(1);
    expect(round("Final")).toBe(2);
  });

  it("still lays out after placeholders are replaced by real winners", () => {
    // Simulate results entered: the semifinal's feeder names become real teams.
    const edited = matches.map((m) =>
      m.match_title === "Final"
        ? { ...m, team_a_name: "Team 1", team_b_name: "Team 4" }
        : m
    );
    const { matches: laid, maxRound } = layoutSection(edited);
    // Final must still be a valid, finite column.
    const final = laid.find((m) => m.match_title === "Final");
    expect(Number.isFinite(final.__round)).toBe(true);
    expect(maxRound).toBeGreaterThanOrEqual(final.__round);
  });
});

describe("computeStandings", () => {
  const m = (a, sa, b, sb, status = "Finished") => ({
    team_a_id: a, team_a_name: a, team_b_id: b, team_b_name: b,
    team_a_score: sa, team_b_score: sb, status,
  });

  it("ranks by points then goal difference, leader first", () => {
    const table = computeStandings([
      m("A", 3, "B", 0), // A win
      m("A", 1, "C", 1), // draw
      m("B", 2, "C", 0), // B win
    ]);
    expect(table.map((t) => t.name)).toEqual(["A", "B", "C"]);
    expect(table[0]).toMatchObject({ name: "A", P: 2, W: 1, D: 1, L: 0, Pts: 4 });
  });

  it("includes teams that have not played yet at zero", () => {
    const table = computeStandings([m("A", 0, "B", 0, "Upcoming")]);
    expect(table).toHaveLength(2);
    expect(table.every((t) => t.P === 0 && t.Pts === 0)).toBe(true);
  });
});

describe("bracketSection — double elimination splits winners/losers", () => {
  const matches = generateDoubleElimination(teams(8));
  it("classifies LB matches as the Losers Bracket", () => {
    const sections = new Set(matches.map(bracketSection));
    expect(sections.has("Winners Bracket")).toBe(true);
    expect(sections.has("Losers Bracket")).toBe(true);
  });
  it("each section lays out without throwing", () => {
    ["Winners Bracket", "Losers Bracket"].forEach((name) => {
      const sm = matches.filter((m) => bracketSection(m) === name);
      const { maxRound } = layoutSection(sm);
      expect(maxRound).toBeGreaterThanOrEqual(0);
    });
  });
});
