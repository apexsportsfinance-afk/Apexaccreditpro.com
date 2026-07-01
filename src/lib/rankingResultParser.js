/**
 * SWIMMERS RANKING — Hy-Tek RESULT parser  (Phase 2)
 * =====================================================================
 * Turns a Hy-Tek Meet Manager *result* PDF into structured swim rows that
 * feed the review-before-approve staging table (ranking_staging_results).
 *
 * This is SEPARATE from CoachHeatParser.js — that one parses HEAT SHEETS
 * (lane/heat/seed-time). This parses finished RESULTS (place/finals-time).
 *
 * Design (calibrated on two real UAE Aquatics LC samples, MM 8.0, 2026-07-01):
 *
 *   Stateful event header sets context for the rows beneath it:
 *     "Event 301  Girls 10 Year Olds 200 LC Meter Freestyle"
 *      → gender=F, ageSpec="10 Year Olds", distance=200, course=LC, stroke=Freestyle
 *
 *   Individual result row (columns: Name | Age | Team | Finals Time):
 *     "1  Olivia Limantara  10  SwimShark Swimming Training  2:57.71"
 *      → place=1, name="Olivia Limantara", age=10, team="...", time=2:57.71
 *     The AGE INTEGER is the split anchor — names AND teams have a variable
 *     number of words, so we anchor on the first standalone 1–3 digit number.
 *
 *   RELAY events (columns: Team | Relay | Finals Time) have NO swimmer and
 *   NO age — they cannot be ranked per-swimmer, so the whole event is SKIPPED.
 *   Detected two ways: (1) event header contains "Relay"; (2) column-header
 *   row has a "Relay" column and no "Age" column.
 *
 *   Exhibition times carry an "x"/"X" prefix (e.g. "x1:53.97"). Product-owner
 *   decision (2026-07-01): exhibition individual swims COUNT — strip the prefix
 *   and treat the time as a normal fastest-time candidate.
 *
 *   DQ/DNS/DNF/NT/NS/SCR/NP rows have no valid time → recognized only so they
 *   can be skipped; they are never emitted. DQ rows also render place as "---".
 *
 *   Course type (SC/LC) is chosen at UPLOAD time (source of truth). The parser
 *   surfaces the header's course as `courseTypeHint` only.
 * =====================================================================
 */

/* ------------------------------------------------------------------ *
 * Small pure helpers (exported for unit testing)
 * ------------------------------------------------------------------ */

/** Map "Girls/Boys/Women/Men/Mixed" → 'F' | 'M' | 'Mixed'. */
export function parseGender(text) {
  const l = (text || '').toLowerCase();
  if (/\b(girls?|women|female)\b/.test(l)) return 'F';
  if (/\b(boys?|men|male)\b/.test(l)) return 'M';
  return 'Mixed';
}

/** Canonical stroke name, or null if unrecognized. */
export function normalizeStroke(raw) {
  const l = (raw || '').toLowerCase();
  if (/butterfly|\bfly\b/.test(l)) return 'Butterfly';
  if (/backstroke|\bback\b/.test(l)) return 'Backstroke';
  if (/breaststroke|\bbreast\b/.test(l)) return 'Breaststroke';
  // IM must be checked before plain "free"/"medley" fallthroughs
  if (/individual medley|medley|\bim\b/.test(l)) return 'Individual Medley';
  if (/freestyle|\bfree\b/.test(l)) return 'Freestyle';
  return null;
}

/** True if this event is a relay (name contains "Relay"). */
export function isRelayEvent(eventName) {
  return /\brelay\b/i.test(eventName || '');
}

/** True if a line is a column-header row (Name/Age/Team/Relay/Finals Time). */
export function isColumnHeaderRow(text) {
  return /\b(name|age|team|relay|finals?\s*time|prelim|seed)\b/i.test(text || '') &&
         !/\d\.\d/.test(text || ''); // header rows never contain a time
}

/** True if a line is a separator (dashes/equals/underscores only). */
export function isSeparatorRow(text) {
  return /^[=_\-—\s]+$/.test((text || '').trim()) && (text || '').trim().length > 0;
}

const STATUS_CODES = /^(DQ|DNS|DNF|DNC|DFS|NS|NT|SCR|NP|WD|X?SCR)$/i;

/** True if a token is a Hy-Tek non-result status code (no valid time). */
export function isStatusCode(token) {
  return STATUS_CODES.test((token || '').trim());
}

/**
 * Parse a Hy-Tek finals time to whole milliseconds.
 * Accepts "28.91", "1:02.45", "10:05.32", optional "x"/"X" exhibition prefix,
 * and an optional trailing qualifier letter ("q", "J", "r", "R").
 * Returns null for status codes / anything not a real time.
 */
export function parseTimeToMs(raw) {
  if (!raw) return null;
  let t = String(raw).trim();
  if (isStatusCode(t)) return null;
  t = t.replace(/^[xX]/, '');            // strip exhibition marker
  t = t.replace(/[a-zA-Z*#!]+$/, '');    // strip trailing qualifier(s)
  const m = t.match(/^(?:(\d{1,3}):)?(\d{1,2})\.(\d{2})$/);
  if (!m) return null;
  const minutes = m[1] ? parseInt(m[1], 10) : 0;
  const seconds = parseInt(m[2], 10);
  const hundredths = parseInt(m[3], 10);
  if (seconds >= 60) return null;        // guard against a misread integer
  return ((minutes * 60 + seconds) * 100 + hundredths) * 10;
}

/** Render whole milliseconds back to a Hy-Tek-style time string. */
export function formatMs(ms) {
  if (ms == null) return null;
  const totalHundredths = Math.round(ms / 10);
  const hundredths = totalHundredths % 100;
  const totalSeconds = Math.floor(totalHundredths / 100);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);
  const hh = String(hundredths).padStart(2, '0');
  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, '0')}.${hh}`;
  }
  return `${seconds}.${hh}`;
}

/**
 * Parse an event-header line.
 * "Event 301  Girls 10 Year Olds 200 LC Meter Freestyle"
 * Returns null if the line is not an event header.
 */
export function parseEventHeader(line) {
  const m = (line || '').match(/^\s*(?:\()?event\s+(\d+)\s+(.+?)\)?\s*$/i);
  if (!m) return null;
  const eventCode = m[1];
  const title = m[2].trim();
  const relay = isRelayEvent(title);

  const gender = parseGender(title);

  // age spec: "10 Year Olds", "14-17", "18 & Over", "9 & Under", "Open"
  const ageMatch = title.match(/(\d+\s*&\s*Over|\d+\s*&\s*Under|\d+\s*-\s*\d+|\d{1,2}\s*Year(?:s)?(?:\s*Old(?:s)?)?|Open|Senior)/i);
  const ageSpec = ageMatch ? ageMatch[1].replace(/\s+/g, ' ').trim() : null;

  // distance + course + stroke: "200 LC Meter Freestyle"
  const dcs = title.match(/(\d+)\s*(?:x\s*\d+\s*)?\s*(LC|SC)?\s*Meter[s]?\s+(.+)$/i);
  let distance = null, courseTypeHint = null, stroke = null;
  if (dcs) {
    distance = parseInt(dcs[1], 10);
    courseTypeHint = dcs[2] ? dcs[2].toUpperCase() : null;
    stroke = normalizeStroke(dcs[3]);
  } else {
    stroke = normalizeStroke(title);
  }

  return { eventCode, title, relay, gender, ageSpec, distance, courseTypeHint, stroke };
}

/** True if a token is a real (parseable) finals/seed time, e.g. "44.00", "x1:53.97". */
export function isTimeToken(token) {
  return parseTimeToMs(token) != null;
}

/**
 * Parse one INDIVIDUAL result row against the age-integer anchor.
 * "1  Olivia Limantara  10  SwimShark Swimming Training  2:57.71"
 * "2  Chelsea Zhao  8  MSC  43.18  q  14  44.89"  (seed + qualifier + points + finals)
 * "--- Oaks Swimming Training  DQ"  (DQ rows: place "---", no age → returns status)
 *
 * After the age the Hy-Tek columns are:  <team words…> [seed] [q] [points] <finals>.
 * A row can carry a SEED time, a "q" finals-qualifier and a points integer BEFORE the
 * finals time — none of which are part of the club. So we don't assume a fixed field
 * count: the team is every token BEFORE the first result token (a time or a status
 * code), and the ranked time is the LAST time-shaped token. Points are bare integers
 * and qualifiers are letters, so neither is mistaken for a time or leaks into the team.
 *
 * Returns:
 *   { place, name, age, team, rawTime, timeMs }         valid swim
 *   { place, name, age, team, status: 'DQ'|... }         non-result row (skip)
 *   null                                                 not a parseable result row
 */
export function parseResultRow(line) {
  const text = (line || '').replace(/\s+/g, ' ').trim();
  if (!text) return null;

  // place is a number, or "---" for DQ/DNS
  const lead = text.match(/^(\d{1,3}|-{2,3})\s+(.+)$/);
  if (!lead) return null;
  const place = /^\d+$/.test(lead[1]) ? parseInt(lead[1], 10) : null;
  const rest = lead[2];

  // Anchor on the age: name is everything before the first standalone 1–3 digit
  // number; everything after is the team + result columns.
  const anchor = rest.match(/^(.+?)\s+(\d{1,3})\s+(.+)$/);
  if (anchor) {
    const name = anchor[1].trim();
    const age = parseInt(anchor[2], 10);
    const tokens = anchor[3].trim().split(' ');

    // Locate the result columns: firstResultIdx = first time-or-status token (the
    // team ends just before it); lastTimeIdx = the finals time (rightmost time).
    let firstResultIdx = -1;
    let lastTimeIdx = -1;
    for (let i = 0; i < tokens.length; i++) {
      const isTime = isTimeToken(tokens[i]);
      if (isTime) lastTimeIdx = i;
      if (firstResultIdx === -1 && (isTime || isStatusCode(tokens[i]))) firstResultIdx = i;
    }
    const team = (firstResultIdx === -1 ? tokens : tokens.slice(0, firstResultIdx)).join(' ').trim();

    if (lastTimeIdx === -1) {
      // No valid time on the row — recognize a status code (DQ/DNS/…) so it's skipped.
      const statusTok = tokens.find(isStatusCode);
      if (statusTok) return { place, name, age, team, status: statusTok.toUpperCase() };
      return null;
    }
    const rawTime = tokens[lastTimeIdx];
    return { place, name, age, team, rawTime, timeMs: parseTimeToMs(rawTime) };
  }

  // No age anchor: could be a DQ row where the last token is a status code
  // ("--- Oaks Swimming Training DQ"). We still recognize it so it's skipped.
  const tail = rest.match(/^(.+?)\s+(\S+)$/);
  if (tail && isStatusCode(tail[2])) {
    return { place, name: tail[1].trim(), age: null, team: tail[1].trim(), status: tail[2].toUpperCase() };
  }
  return null;
}

/**
 * Split a line that pdf.js merged from a TWO-COLUMN results page back into its
 * individual result records. Hy-Tek prints two side-by-side result tables; when a
 * left-column row and a right-column row share a y-coordinate, extraction joins
 * them into one line ("1 Ali 11 4LSA 2:30.48 7 Barker 15 Msc Dubai 2:18.78"),
 * which would otherwise drop the second swimmer and misread the first one's time.
 *
 * Conservative by design: it only splits when it finds TWO OR MORE complete
 * "place … age … team … finalsTime" records, where each finals time is followed by
 * either the start of another place record or end-of-line. A normal single row, a
 * DQ row without an age, and a seed-time row (extra time/points before the finals
 * time) all yield ≤1 match and pass through unchanged.
 *
 * @returns {string[]} one entry per detected record, or [line] if not a merge.
 */
const TWO_COL_RECORD =
  /(?:\d{1,3}|-{2,3})\s+.+?\s+\d{1,3}\s+.+?\s+(?:[xX]?(?:\d{1,3}:)?\d{1,2}\.\d{2}[a-zA-Z*#!]*|DQ|DNS|DNF|DNC|DFS|NS|NT|SCR|NP|WD)(?=\s+(?:\d{1,3}|-{2,3})\s|\s*$)/g;
export function splitMergedResultLine(line) {
  const text = (line || '').replace(/\s+/g, ' ').trim();
  if (!text) return [text];
  const matches = text.match(TWO_COL_RECORD);
  // Require the matches to cover essentially the whole line, so we don't split a
  // line where the regex only happened to catch a fragment.
  if (matches && matches.length >= 2 && matches.join(' ').length >= text.length - 2) {
    return matches.map((m) => m.trim());
  }
  return [text];
}

/**
 * Parse the meet header block (best-effort) from the first extracted lines.
 * "Open Swimming Championship - June 2026 - 27/06/2026 to 28/06/2026"
 * "UAE Aquatics"
 */
export function parseMeetHeader(lines) {
  const meet = { name: null, startDate: null, endDate: null, season: null, sanctioningBody: null };
  for (const raw of lines) {
    const line = (raw || '').replace(/\s+/g, ' ').trim();
    if (!line) continue;
    // The meet header block always precedes the first event — stop there so a
    // stray result/relay row can never be mistaken for header metadata.
    if (parseEventHeader(line)) break;
    // Never treat a result-shaped row (leading place / "---", or a status code)
    // as header text.
    const looksLikeResultRow = /^(\d{1,3}|-{2,3})\s/.test(line) || isStatusCode(line.split(' ').pop());

    const range = line.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s*(?:to|-|–|—)\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (range) {
      meet.startDate = toIso(range[1]);
      meet.endDate = toIso(range[2]);
      if (meet.startDate) meet.season = parseInt(meet.startDate.slice(0, 4), 10);
      if (!meet.name) meet.name = line.split(/\s*-\s*/)[0].trim();
    }
    // First plausible sanctioning-body line wins (don't let later lines clobber).
    if (!meet.sanctioningBody && !looksLikeResultRow &&
        /aquatics|federation|association|swimming/i.test(line) &&
        line.length < 40 && !/\d/.test(line)) {
      meet.sanctioningBody = line;
    }
  }
  return meet;
}

function toIso(ddmmyyyy) {
  const m = (ddmmyyyy || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ *
 * Core processor — pure, testable. Takes an array of text lines.
 * ------------------------------------------------------------------ */

/**
 * @param {string[]} lines   extracted text lines (one per PDF/text row)
 * @param {object}   opts
 * @param {'SC'|'LC'} opts.courseType   upload-time course (source of truth)
 * @param {number}   [opts.season]      override season; else from meet header
 * @returns {{ meet, results, stats, warnings }}
 */
export function processResultRows(lines, opts = {}) {
  const courseType = opts.courseType || null;
  const meet = parseMeetHeader(lines);
  if (opts.season) meet.season = opts.season;

  const results = [];
  const warnings = [];
  const stats = {
    events: 0, individualEvents: 0, relayEventsSkipped: 0,
    resultsParsed: 0, statusSkipped: 0, unparsedLines: 0,
  };

  let event = null;      // current individual event context, or null
  let skipping = false;  // inside a relay event → skip rows

  for (const raw of lines) {
    const line = (raw || '').replace(/\s+/g, ' ').trim();
    if (!line) continue;

    // --- event header switches context ---
    const header = parseEventHeader(line);
    if (header) {
      stats.events++;
      if (header.relay) {
        stats.relayEventsSkipped++;
        skipping = true;
        event = null;
        continue;
      }
      // individual event
      skipping = false;
      stats.individualEvents++;
      if (!header.stroke || !header.distance) {
        warnings.push(`Event ${header.eventCode}: could not read stroke/distance from "${header.title}"`);
      }
      event = header;
      continue;
    }

    if (skipping) continue;                 // inside a relay event
    if (!event) continue;                   // rows before the first event
    if (isSeparatorRow(line)) continue;
    if (isColumnHeaderRow(line)) continue;

    // A two-column page can merge two swimmers' rows onto one line — split them
    // back apart so neither swimmer (nor their time) is lost.
    const records = splitMergedResultLine(line);
    if (records.length > 1) stats.twoColumnLinesSplit = (stats.twoColumnLinesSplit || 0) + 1;
    for (const record of records) {
      const row = parseResultRow(record);
      if (!row) { stats.unparsedLines++; continue; }
      if (row.status) { stats.statusSkipped++; continue; }

      const ageGroupLabel = `${row.age} Year Olds`;
      results.push({
      // raw fields for the correction grid
      rawName: row.name,
      rawTeam: row.team,
      rawTime: row.rawTime,
      // parsed fields (align with ranking_staging_results columns)
      fullName: row.name,
      clubName: row.team,
      gender: event.gender === 'Mixed' ? null : event.gender,
      stroke: event.stroke,
      distance: event.distance,
      courseTypeHint: event.courseTypeHint,
      courseType,                           // upload-time choice = source of truth
      ageAtSwim: row.age,
      ageGroupLabel,
      swimDate: meet.startDate || null,
      season: meet.season || null,
      timeMs: row.timeMs,
      timeDisplay: formatMs(row.timeMs),
      finishPosition: row.place,
      eventCode: event.eventCode,
      });
      stats.resultsParsed++;
    }
  }

  return { meet, results, stats, warnings };
}

/* ------------------------------------------------------------------ *
 * Browser entry points — PDF extraction (pdfjs), same approach as
 * CoachHeatParser: group text items by y-coordinate into visual rows.
 * ------------------------------------------------------------------ */

let pdfjsLib = null;
async function getPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  return pdfjsLib;
}

/** Extract a result PDF into visual text rows (array of strings). */
export async function extractPdfLines(file) {
  const pdfjs = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const lines = [];
  let pageCount = 0;
  for (let i = 1; i <= pdf.numPages; i++) {
    pageCount++;
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const byRow = {};
    for (const item of content.items) {
      const y = Math.round(item.transform[5]);
      (byRow[y] = byRow[y] || []).push(item);
    }
    const sortedY = Object.keys(byRow).sort((a, b) => b - a);
    for (const y of sortedY) {
      const text = byRow[y]
        .sort((a, b) => a.transform[4] - b.transform[4])
        .map(it => it.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (text) lines.push(text);
    }
  }
  return { lines, pageCount };
}

/**
 * Top-level: parse a result PDF File into staged rows.
 * @param {File} file
 * @param {{ courseType: 'SC'|'LC', season?: number }} opts
 */
export async function parseRankingResultPdf(file, opts = {}) {
  const { lines, pageCount } = await extractPdfLines(file);
  const out = processResultRows(lines, opts);
  out.stats.pageCount = pageCount;
  return out;
}
