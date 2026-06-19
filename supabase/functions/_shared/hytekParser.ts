// ============================================================================
// Hy-Tek results parser — canonical TypeScript port of `parse_hytek_text` in
// scripts/medal_api.py. This is the SINGLE source of truth: the parse-results
// edge function imports it, and hytekParser.test.ts proves parity with the
// Python regex behavior.
//
// Keep this byte-for-byte equivalent to the Python regexes:
//   EVENT_HEADER_PATTERN     = (?:\(Event\s+|Event\s+)(\d+)\s+(Boys|Girls|Mixed)\s+(.*?)\s+(\d+\s+.*Meter.*)   [i]
//   INDIVIDUAL_RESULT_PATTERN = ^\s*([123])\s+(.+?)\s+(\d{1,2})\s+(.+?)\s+([\d:.]{4,})                          [i]
// ============================================================================

export interface MedalResult {
  swimmer_name: string;
  team: string;
  result_time: string;
  gender: string;
  age_group: string;
  event_name: string;
  event_type: "relay" | "individual";
  place: number;
  competition: string;
}

interface CurrentEvent {
  gender: string;
  age_group: string;
  event_name: string;
  event_type: "relay" | "individual";
}

// Note: `search` semantics (match anywhere) for the header; `match`/anchored
// (the leading ^) for the result row — mirroring re.search / re.match in Python.
const EVENT_HEADER =
  /(?:\(Event\s+|Event\s+)(\d+)\s+(Boys|Girls|Mixed)\s+(.*?)\s+(\d+\s+.*Meter.*)/i;
const INDIVIDUAL_RESULT = /^\s*([123])\s+(.+?)\s+(\d{1,2})\s+(.+?)\s+([\d:.]{4,})/i;

export function parseHytekResults(
  text: string,
  competitionName = "Unknown Competition"
): MedalResult[] {
  const results: MedalResult[] = [];
  let currentEvent: CurrentEvent | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const eventMatch = EVENT_HEADER.exec(line);
    if (eventMatch) {
      currentEvent = {
        gender: eventMatch[2].trim(),
        age_group: eventMatch[3].trim(),
        event_name: eventMatch[4].replace(/\)/g, "").trim(),
        event_type: line.includes("Relay") ? "relay" : "individual",
      };
      continue;
    }

    if (currentEvent) {
      const resMatch = INDIVIDUAL_RESULT.exec(line);
      if (resMatch) {
        const place = parseInt(resMatch[1], 10);
        if (place > 3) continue; // only podium places, same as Python

        results.push({
          swimmer_name: resMatch[2].trim(),
          team: resMatch[4].trim(),
          result_time: resMatch[5].trim(),
          gender: currentEvent.gender,
          age_group: currentEvent.age_group,
          event_name: currentEvent.event_name,
          event_type: currentEvent.event_type,
          place,
          competition: competitionName,
        });
      }
    }
  }

  return results;
}
