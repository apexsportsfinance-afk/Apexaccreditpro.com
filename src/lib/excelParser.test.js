import { describe, it, expect } from "vitest";
import { parsePdfTextToEvents } from "./excelParser";

// Coverage for the pure PDF-text → events parser used by the admin event-import
// flow. It handles operator-supplied (untrusted) text, so column/date/age parsing
// and the skip rules for non-event lines are worth locking down. The Excel reader
// (`parseExcelEvents`) is not tested here — it depends on the DOM `FileReader`.

describe("parsePdfTextToEvents", () => {
  it("parses a fully-populated event row into structured fields", () => {
    const text =
      "E101  100m Freestyle  Male  12-14  S1  2025-06-15  10:00  Main Pool";
    const [ev] = parsePdfTextToEvents(text);
    expect(ev).toEqual({
      eventCode: "E101",
      eventName: "100m Freestyle",
      gender: "Male",
      ageMin: "12",
      ageMax: "14",
      session: "S1",
      date: "2025-06-15",
      startTime: "10:00",
      venue: "Main Pool",
    });
  });

  it("normalizes a DD/MM/YYYY date to ISO", () => {
    const [ev] = parsePdfTextToEvents("X12  Sprint Final  15/06/2025");
    expect(ev.date).toBe("2025-06-15");
  });

  it("keeps an already-ISO date unchanged", () => {
    const [ev] = parsePdfTextToEvents("X12  Sprint Final  2025-06-15");
    expect(ev.date).toBe("2025-06-15");
  });

  it("falls back to the code as the name when no name token remains", () => {
    // every column is consumed as age/date/time -> no leftover name token
    const [ev] = parsePdfTextToEvents("E5  12-14  2025-06-15  10:00");
    expect(ev.eventCode).toBe("E5");
    expect(ev.eventName).toBe("E5");
    expect(ev.ageMin).toBe("12");
    expect(ev.date).toBe("2025-06-15");
    expect(ev.startTime).toBe("10:00");
  });

  it("skips header/prose lines that do not start with an uppercase code", () => {
    const text = [
      "Event List for the 2025 Meet",
      "please find the schedule below",
      "E200  200m Medley  Female  2025-07-01",
    ].join("\n");
    const events = parsePdfTextToEvents(text);
    expect(events).toHaveLength(1);
    expect(events[0].eventCode).toBe("E200");
    expect(events[0].gender).toBe("Female");
  });

  it("skips very short lines and returns [] for empty/garbage input", () => {
    expect(parsePdfTextToEvents("")).toEqual([]);
    expect(parsePdfTextToEvents("ab\n--\n  ")).toEqual([]);
  });

  it("leaves age and date null when absent", () => {
    const [ev] = parsePdfTextToEvents("R7  Opening Ceremony  Mixed");
    expect(ev.eventName).toBe("Opening Ceremony");
    expect(ev.gender).toBe("Mixed");
    expect(ev.ageMin).toBe(null);
    expect(ev.ageMax).toBe(null);
    expect(ev.date).toBe(null);
  });
});
