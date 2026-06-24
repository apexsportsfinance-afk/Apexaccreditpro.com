import { describe, it, expect } from "vitest";
import {
  generateRoundRobin,
  generateSingleElimination,
  generateFixtures,
  buildMatchRows,
} from "./fixtureGenerators";

const teams = (n) => Array.from({ length: n }, (_, i) => ({ id: `t${i + 1}`, name: `Team ${i + 1}` }));
const pairKey = (m) => [m.team_a_name, m.team_b_name].sort().join(" vs ");

describe("generateRoundRobin", () => {
  it("produces every unique pairing once for an even field", () => {
    const out = generateRoundRobin(teams(4));
    expect(out).toHaveLength(6); // C(4,2)
    const unique = new Set(out.map(pairKey));
    expect(unique.size).toBe(6);
  });

  it("never schedules a team against itself", () => {
    for (const m of generateRoundRobin(teams(6))) {
      expect(m.team_a_name).not.toBe(m.team_b_name);
    }
  });

  it("handles an odd field by giving byes (no BYE matches emitted)", () => {
    const out = generateRoundRobin(teams(3));
    expect(out).toHaveLength(3); // C(3,2)
    expect(out.some((m) => m.team_a_name === "BYE" || m.team_b_name === "BYE")).toBe(false);
  });

  it("doubles the schedule and swaps home/away for a double round", () => {
    const out = generateRoundRobin(teams(2), { doubleRound: true });
    expect(out).toHaveLength(2);
    expect(out[0].team_a_name).toBe(out[1].team_b_name);
    expect(out[0].team_b_name).toBe(out[1].team_a_name);
  });

  it("returns nothing for fewer than two teams", () => {
    expect(generateRoundRobin(teams(1))).toEqual([]);
    expect(generateRoundRobin([])).toEqual([]);
  });
});

describe("generateSingleElimination", () => {
  it("creates exactly n-1 matches (each match eliminates one team)", () => {
    expect(generateSingleElimination(teams(4))).toHaveLength(3);
    expect(generateSingleElimination(teams(8))).toHaveLength(7);
    expect(generateSingleElimination(teams(2))).toHaveLength(1);
  });

  it("handles non-power-of-two fields with byes (still n-1 matches)", () => {
    expect(generateSingleElimination(teams(5))).toHaveLength(4);
    expect(generateSingleElimination(teams(6))).toHaveLength(5);
    expect(generateSingleElimination(teams(7))).toHaveLength(6);
  });

  it("returns nothing for fewer than two teams", () => {
    expect(generateSingleElimination(teams(1))).toEqual([]);
  });
});

describe("generateFixtures (dispatcher)", () => {
  it("routes known formats", () => {
    expect(generateFixtures("Round Robin", teams(4))).toHaveLength(6);
    expect(generateFixtures("Single Elimination", teams(4))).toHaveLength(3);
  });
  it("returns [] for an unknown format", () => {
    expect(generateFixtures("Nope", teams(4))).toEqual([]);
  });
});

describe("buildMatchRows", () => {
  const fixtures = [
    { match_title: "R1", team_a_id: "a", team_a_name: "A", team_b_id: "b", team_b_name: "B", round_offset: 0 },
    { match_title: "R2", team_a_id: "a", team_a_name: "A", team_b_id: "b", team_b_name: "B", round_offset: 1 },
  ];

  it("dates round 0 at startDate and spaces later rounds (timezone-correct)", () => {
    const rows = buildMatchRows(fixtures, {
      eventId: "e1",
      sportId: "s1",
      startDate: "2026-01-01",
      daysBetweenRounds: 7,
    });
    // Must keep the intended calendar date regardless of the machine timezone
    // (regression guard for the prior toISOString off-by-one in UTC+ zones).
    expect(rows[0].match_date).toBe("2026-01-01");
    expect(rows[1].match_date).toBe("2026-01-08");
  });

  it("applies sane defaults (zero scores, status, time)", () => {
    const [row] = buildMatchRows(fixtures, { eventId: "e1", sportId: "s1", startDate: "2026-01-01" });
    expect(row).toMatchObject({
      event_id: "e1",
      sport_id: "s1",
      team_a_score: "0",
      team_b_score: "0",
      match_time: "12:00",
      status: "Upcoming",
    });
  });
});
