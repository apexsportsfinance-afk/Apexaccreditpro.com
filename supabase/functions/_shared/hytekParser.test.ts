import { describe, it, expect } from "vitest";
import { parseHytekResults } from "./hytekParser";

// Parity tests: these assert the TS port behaves like the Python
// `parse_hytek_text` (scripts/medal_api.py). If the medal parser is ever cut
// over to the edge function, these guard against regressions.

describe("parseHytekResults — event headers", () => {
  it("parses gender, age group, and distance from an event header", () => {
    const text = [
      "Event 12 Girls 11-12 200 Meter Freestyle",
      "  1 Smith, Jane 12 Dolphins SC 2:05.43",
    ].join("\n");

    const [r] = parseHytekResults(text, "Summer Meet");
    expect(r).toMatchObject({
      gender: "Girls",
      age_group: "11-12",
      event_name: "200 Meter Freestyle",
      event_type: "individual",
      swimmer_name: "Smith, Jane",
      team: "Dolphins SC",
      result_time: "2:05.43",
      place: 1,
      competition: "Summer Meet",
    });
  });

  it("flags relay events via the 'Relay' keyword", () => {
    const text = [
      "Event 20 Mixed 13-14 200 Meter Freestyle Relay",
      "  1 Team A 13 Sharks 1:45.10",
    ].join("\n");
    expect(parseHytekResults(text)[0].event_type).toBe("relay");
  });

  it("handles the parenthesised '(Event N ...' header form", () => {
    const text = ["(Event 5 Boys 9-10 50 Meter Backstroke)", "  1 Doe, John 10 Eels 0:35.12"].join(
      "\n"
    );
    const [r] = parseHytekResults(text);
    expect(r.gender).toBe("Boys");
    // trailing ")" is stripped from the distance/event_name
    expect(r.event_name).toContain("50 Meter Backstroke");
    expect(r.event_name).not.toContain(")");
  });
});

describe("parseHytekResults — placements", () => {
  const text = [
    "Event 1 Boys 9-10 100 Meter Freestyle",
    "  1 Alpha, A 10 Club X 1:00.00",
    "  2 Bravo, B 9 Club Y 1:01.50",
    "  3 Charlie, C 10 Club Z 1:02.10",
    "  4 Delta, D 9 Club W 1:03.00",
  ].join("\n");

  it("captures only podium places 1-3 and skips 4+", () => {
    const out = parseHytekResults(text);
    expect(out).toHaveLength(3);
    expect(out.map((r) => r.place)).toEqual([1, 2, 3]);
    expect(out.find((r) => r.swimmer_name === "Delta, D")).toBeUndefined();
  });
});

describe("parseHytekResults — edge cases", () => {
  it("ignores result rows that appear before any event header", () => {
    const text = ["  1 Orphan, O 10 Nobody 1:00.00", "Event 2 Girls 11-12 50 Meter Fly", "  1 Real, R 12 Somebody 0:30.00"].join("\n");
    const out = parseHytekResults(text);
    expect(out).toHaveLength(1);
    expect(out[0].swimmer_name).toBe("Real, R");
  });

  it("ignores blank lines and non-matching text", () => {
    const text = ["", "Heat Sheet — unofficial", "Event 3 Mixed 15-16 100 Meter IM", "", "  1 Echo, E 15 Club Q 1:10.00"].join("\n");
    const out = parseHytekResults(text);
    expect(out).toHaveLength(1);
    expect(out[0].event_name).toBe("100 Meter IM");
  });

  it("defaults the competition name when none is given", () => {
    const text = ["Event 4 Boys 9-10 50 Meter Free", "  1 Foxtrot, F 10 Club R 0:28.00"].join("\n");
    expect(parseHytekResults(text)[0].competition).toBe("Unknown Competition");
  });

  it("returns an empty array for empty input", () => {
    expect(parseHytekResults("")).toEqual([]);
  });
});
