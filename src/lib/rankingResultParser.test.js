import { describe, it, expect } from 'vitest';
import {
  parseGender,
  normalizeStroke,
  isRelayEvent,
  isColumnHeaderRow,
  isSeparatorRow,
  isStatusCode,
  isTimeToken,
  parseTimeToMs,
  formatMs,
  parseEventHeader,
  parseResultRow,
  parseMeetHeader,
  processResultRows,
  splitMergedResultLine,
} from './rankingResultParser.js';

/* ---------------------------------------------------------------- *
 * Fixture: lines exactly as extracted from the two REAL LC samples
 * (UAE Aquatics, MM 8.0). Relay events 215 & 216 + individual 301.
 * ---------------------------------------------------------------- */
const SAMPLE_LINES = [
  'Open Swimming Championship - June 2026 - 27/06/2026 to 28/06/2026',
  'UAE Aquatics',

  // --- RELAY event 215 (must be skipped wholesale) ---
  'Event 215  Boys 14-17 200 LC Meter Medley Relay',
  'Team Relay Finals Time',
  '1 Hamirya  Culture Sports Club A 1:56.59',
  '2 Mleeha Cultural & Sports Club A 1:58.09',
  '3 Rika Sports Academy A 1:59.65',
  '4 Aquatix Swimming Training A 2:00.57',
  '5 Hamilton Aquatics Dubai B 2:03.81',
  '6 Tyneside Swim Club A 2:04.33',
  '7 AL Bataeh Sports Club A 2:12.28',
  '8 Evolution Sports Academy A 2:16.08',
  '9 ProActive Swimming Club A 2:18.33',
  '--- Oaks Swimming Training A DQ',
  '--- AL Mudam Sports Club A DQ',

  // --- RELAY event 216 (skipped; contains an exhibition x-time) ---
  'Event 216  Boys 18 & Over 200 LC Meter Medley Relay',
  'Team Relay Finals Time',
  '1 Calibre A 1:47.41',
  '2 Tsd Team A 1:49.70',
  '3 Speedo Swim Squads A 1:51.58',
  '4 AL Bataeh Sports Club A 1:53.82',
  '5 Calibre B x1:53.97',
  '6 Fit Republik Aquatics A 2:01.33',
  '7 AL Mudam Sports Club A 2:02.83',
  '8 Evolution Sports Academy A 2:05.10',

  // --- INDIVIDUAL event 301 (all 14 rows should parse) ---
  'Event 301  Girls 10 Year Olds 200 LC Meter Freestyle',
  'Name Age Team Finals Time',
  '1 Olivia Limantara 10 SwimShark Swimming Training 2:57.71',
  '2 Alisa Kobozeva 10 ProActive Swimming Club 2:58.02',
  '3 Esther Bettles 10 Tyneside Swim Club 2:59.25',
  '4 Zoey Max Ramos 10 Francis Sport Academy 2:59.82',
  '5 Glany Cubero 10 Westford Sports 3:01.11',
  '6 Ellen van der Sluijs 10 Tyneside Swim Club 3:02.47',
  '7 Yifei Cathy Lyu 10 Tyneside Swim Club 3:03.50',
  '8 Sewon Cho 10 Cognita Enrich ME Aquatics 3:04.99',
  '9 Shanaya Bharti 10 Hamilton Aquatics Dubai 3:07.14',
  '10 Mia Moussalem 10 Tyneside Swim Club 3:07.71',
  '11 Ava Seprado 10 Westford Sports 3:09.08',
  '12 Mokshita BS 10 Aqua Nation Sports Academy 3:09.32',
  '13 Inaya Checkar 10 Aqua Nation Sports Academy 3:14.83',
  '14 Malak Mazen Dabas 10 Ajman Sports Academy 3:26.33',
];

describe('time parsing', () => {
  it('parses seconds-only and minute times to ms', () => {
    expect(parseTimeToMs('28.91')).toBe(28910);
    expect(parseTimeToMs('2:57.71')).toBe(177710);
    expect(parseTimeToMs('1:47.41')).toBe(107410);
    expect(parseTimeToMs('10:05.32')).toBe(605320);
  });

  it('strips the exhibition x prefix and still counts the time', () => {
    expect(parseTimeToMs('x1:53.97')).toBe(113970);
    expect(parseTimeToMs('X28.91')).toBe(28910);
    // same numeric value with or without the marker
    expect(parseTimeToMs('x1:53.97')).toBe(parseTimeToMs('1:53.97'));
  });

  it('strips a trailing qualifier letter', () => {
    expect(parseTimeToMs('28.91q')).toBe(28910);
    expect(parseTimeToMs('1:02.45J')).toBe(62450);
  });

  it('returns null for status codes and malformed times', () => {
    for (const s of ['DQ', 'DNS', 'DNF', 'NT', 'NS', 'SCR', 'NP']) {
      expect(parseTimeToMs(s)).toBeNull();
    }
    expect(parseTimeToMs('')).toBeNull();
    expect(parseTimeToMs('foo')).toBeNull();
    expect(parseTimeToMs('1:99.00')).toBeNull(); // seconds >= 60 guard
  });

  it('round-trips ms back to a display string', () => {
    expect(formatMs(177710)).toBe('2:57.71');
    expect(formatMs(28910)).toBe('28.91');
    expect(formatMs(107410)).toBe('1:47.41');
    expect(formatMs(parseTimeToMs('3:26.33'))).toBe('3:26.33');
  });
});

describe('classifiers', () => {
  it('detects gender from event titles', () => {
    expect(parseGender('Girls 10 Year Olds 200 LC Meter Freestyle')).toBe('F');
    expect(parseGender('Boys 14-17 200 LC Meter Medley Relay')).toBe('M');
    expect(parseGender('Mixed 200 LC Meter Freestyle Relay')).toBe('Mixed');
  });

  it('normalizes strokes', () => {
    expect(normalizeStroke('Freestyle')).toBe('Freestyle');
    expect(normalizeStroke('Medley Relay')).toBe('Individual Medley');
    expect(normalizeStroke('Butterfly')).toBe('Butterfly');
    expect(normalizeStroke('Backstroke')).toBe('Backstroke');
    expect(normalizeStroke('Breaststroke')).toBe('Breaststroke');
    expect(normalizeStroke('nonsense')).toBeNull();
  });

  it('detects relay events, header rows and separators', () => {
    expect(isRelayEvent('Boys 14-17 200 LC Meter Medley Relay')).toBe(true);
    expect(isRelayEvent('Girls 10 Year Olds 200 LC Meter Freestyle')).toBe(false);
    expect(isColumnHeaderRow('Name Age Team Finals Time')).toBe(true);
    expect(isColumnHeaderRow('Team Relay Finals Time')).toBe(true);
    expect(isColumnHeaderRow('1 Olivia Limantara 10 SwimShark 2:57.71')).toBe(false);
    expect(isSeparatorRow('--------------------')).toBe(true);
    expect(isSeparatorRow('1 Olivia 10 Club 2:57.71')).toBe(false);
    expect(isStatusCode('DQ')).toBe(true);
    expect(isStatusCode('2:57.71')).toBe(false);
  });
});

describe('event header parsing', () => {
  it('parses an individual event header', () => {
    const h = parseEventHeader('Event 301  Girls 10 Year Olds 200 LC Meter Freestyle');
    expect(h).toMatchObject({
      eventCode: '301', relay: false, gender: 'F',
      distance: 200, courseTypeHint: 'LC', stroke: 'Freestyle',
    });
    expect(h.ageSpec).toMatch(/10 Year/i);
  });

  it('flags relay event headers', () => {
    expect(parseEventHeader('Event 215  Boys 14-17 200 LC Meter Medley Relay').relay).toBe(true);
    expect(parseEventHeader('Event 216  Boys 18 & Over 200 LC Meter Medley Relay').relay).toBe(true);
  });

  it('returns null for non-headers', () => {
    expect(parseEventHeader('1 Olivia Limantara 10 SwimShark 2:57.71')).toBeNull();
    expect(parseEventHeader('Name Age Team Finals Time')).toBeNull();
  });
});

describe('individual row parsing (age-anchor)', () => {
  it('splits variable-word names and teams on the age integer', () => {
    expect(parseResultRow('1 Olivia Limantara 10 SwimShark Swimming Training 2:57.71'))
      .toMatchObject({ place: 1, name: 'Olivia Limantara', age: 10, team: 'SwimShark Swimming Training', timeMs: 177710 });
    // 3-word name
    expect(parseResultRow('4 Zoey Max Ramos 10 Francis Sport Academy 2:59.82'))
      .toMatchObject({ name: 'Zoey Max Ramos', age: 10, team: 'Francis Sport Academy' });
    // lowercase particles in the name
    expect(parseResultRow('6 Ellen van der Sluijs 10 Tyneside Swim Club 3:02.47'))
      .toMatchObject({ name: 'Ellen van der Sluijs', age: 10, team: 'Tyneside Swim Club' });
  });

  it('recognizes DQ rows (place "---") as skippable status rows', () => {
    const r = parseResultRow('--- Oaks Swimming Training A DQ');
    expect(r.status).toBe('DQ');
  });

  // --- Prelims+finals layouts: a SEED time, "q" qualifier and points can sit
  //     between the team and the finals time. None belong to the club, and the
  //     ranked time is the finals (rightmost) time. Regression for the Dubai
  //     Open import where clubs came through as "44.00" / "MSC 43.18 q 14".
  it('keeps the club clean when a seed time precedes the finals time', () => {
    expect(parseResultRow('2 Chelsea Zhao 8 MSC 43.18 44.89'))
      .toMatchObject({ place: 2, name: 'Chelsea Zhao', age: 8, team: 'MSC', timeMs: 44890 });
  });

  it('ignores a "q" qualifier and points between the seed and finals times', () => {
    expect(parseResultRow('2 Chelsea Zhao 8 MSC 43.18 q 14 44.89'))
      .toMatchObject({ name: 'Chelsea Zhao', team: 'MSC', rawTime: '44.89', timeMs: 44890 });
  });

  it('yields an empty club (not the seed time) when the source has no team', () => {
    expect(parseResultRow('2 Fairbairn, Stephanie 8 44.00 40.32'))
      .toMatchObject({ name: 'Fairbairn, Stephanie', age: 8, team: '', timeMs: 40320 });
  });

  it('does not let a status-code seed ("NT") leak into the club', () => {
    expect(parseResultRow('3 Ada Lovelace 9 Tyneside Swim Club NT 41.10'))
      .toMatchObject({ name: 'Ada Lovelace', team: 'Tyneside Swim Club', timeMs: 41100 });
  });

  it('takes the finals (rightmost) time, not the seed, as the ranked time', () => {
    // seed 44.00 is slower than finals 40.32 — the ranked swim must be 40.32
    expect(parseResultRow('1 Someone Fast 10 Some Club 44.00 40.32').timeMs).toBe(40320);
  });

  it('recognizes an age-row DQ (status after the team, no finals time)', () => {
    expect(parseResultRow('4 Jane Doe 11 Some Club DQ'))
      .toMatchObject({ name: 'Jane Doe', age: 11, team: 'Some Club', status: 'DQ' });
  });

  it('classifies time-shaped tokens', () => {
    expect(isTimeToken('44.00')).toBe(true);
    expect(isTimeToken('1:02.45')).toBe(true);
    expect(isTimeToken('x1:53.97')).toBe(true);
    expect(isTimeToken('14')).toBe(false);   // points, not a time
    expect(isTimeToken('q')).toBe(false);    // qualifier
    expect(isTimeToken('MSC')).toBe(false);
    expect(isTimeToken('NT')).toBe(false);   // status, not a time
  });

  it('counts an exhibition individual swim (synthetic — strips x)', () => {
    // No individual exhibition row exists in the samples; this documents the
    // product-owner decision that exhibition individual swims COUNT.
    const r = parseResultRow('3 Some Swimmer 11 Some Club x1:02.45');
    expect(r.timeMs).toBe(62450);
    expect(r.status).toBeUndefined();
  });

  it('does not misparse a relay row as an individual result', () => {
    // relay rows have a squad letter (A/B) where the age would be — no anchor
    expect(parseResultRow('5 Calibre B x1:53.97')).toBeNull();
    expect(parseResultRow('1 Hamilton Aquatics Dubai A 1:56.59')).toBeNull();
  });
});

describe('meet header parsing', () => {
  it('extracts name, date range, season and sanctioning body', () => {
    const meet = parseMeetHeader(SAMPLE_LINES);
    expect(meet.startDate).toBe('2026-06-27');
    expect(meet.endDate).toBe('2026-06-28');
    expect(meet.season).toBe(2026);
    expect(meet.sanctioningBody).toBe('UAE Aquatics');
    expect(meet.name).toMatch(/Open Swimming Championship/);
  });
});

describe('end-to-end: full sample document', () => {
  const out = processResultRows(SAMPLE_LINES, { courseType: 'LC' });

  it('skips both relay events and parses only the individual event', () => {
    expect(out.stats.relayEventsSkipped).toBe(2);
    expect(out.stats.individualEvents).toBe(1);
    expect(out.stats.resultsParsed).toBe(14); // all 14 girls, zero relay rows
    expect(out.results).toHaveLength(14);
  });

  it('maps every result to the staging-table shape', () => {
    const first = out.results[0];
    expect(first).toMatchObject({
      fullName: 'Olivia Limantara',
      clubName: 'SwimShark Swimming Training',
      gender: 'F',
      stroke: 'Freestyle',
      distance: 200,
      courseType: 'LC',
      ageAtSwim: 10,
      ageGroupLabel: '10 Year Olds',
      timeMs: 177710,
      timeDisplay: '2:57.71',
      finishPosition: 1,
      season: 2026,
      swimDate: '2026-06-27',
      eventCode: '301',
    });
    // raw fields preserved for the correction grid
    expect(first.rawName).toBe('Olivia Limantara');
    expect(first.rawTime).toBe('2:57.71');
  });

  it('preserves the last swimmer and slowest time', () => {
    const last = out.results[out.results.length - 1];
    expect(last).toMatchObject({
      fullName: 'Malak Mazen Dabas', ageAtSwim: 10,
      finishPosition: 14, timeMs: 206330, timeDisplay: '3:26.33',
    });
  });

  it('emits no relay team names into the results', () => {
    const clubs = out.results.map(r => r.clubName);
    expect(clubs).not.toContain('Calibre');   // relay-only team
    expect(clubs.every(Boolean)).toBe(true);
  });

  it('never emits a status/DQ row as a valid time', () => {
    expect(out.results.every(r => r.timeMs > 0)).toBe(true);
  });
});

/* ---------------------------------------------------------------- *
 * Two-column merge: a left- and right-column row joined by pdf.js
 * onto one line must split back into both swimmers, each with its
 * OWN team and OWN time — and normal rows must be left untouched.
 * ---------------------------------------------------------------- */
describe('splitMergedResultLine (two-column pages)', () => {
  it('leaves a normal single-column row untouched', () => {
    const line = '1 Ali, Jaidaa 11 4LSA 2:30.48';
    expect(splitMergedResultLine(line)).toEqual([line]);
  });

  it('leaves a seed-time + qualifier + points row untouched (only one finals record)', () => {
    const line = '2 Chelsea Zhao 8 MSC 43.18 q 14 44.89';
    expect(splitMergedResultLine(line)).toEqual([line]);
  });

  it('leaves a DQ row without an age untouched', () => {
    const line = '--- Oaks Swimming Training A DQ';
    expect(splitMergedResultLine(line)).toEqual([line]);
  });

  it('splits two merged records, preserving each team and time', () => {
    const parts = splitMergedResultLine(
      '1 Ali, Jaidaa 11 4LSA 2:30.48 7 Barker Santos, Nicole 15 Msc Dubai 2:18.78',
    );
    expect(parts).toEqual([
      '1 Ali, Jaidaa 11 4LSA 2:30.48',
      '7 Barker Santos, Nicole 15 Msc Dubai 2:18.78',
    ]);
  });

  it('recovers both swimmers (right column not dropped, left time not mangled)', () => {
    const out = processResultRows([
      'Event 1  Girls 10-11 200 LC Meter Freestyle',
      'Name Age Team Finals Time',
      '1 Ali, Jaidaa 11 4LSA 2:30.48 8 Ahemd Kheira, Haya 15 Msc Dubai 2:21.71',
      '2 Gracheva, Anastasia 11 Speedo 2:35.28 9 Sytnik, Alisa 15 Hamilton 2:21.98',
    ], { courseType: 'LC' });
    expect(out.results).toHaveLength(4);
    expect(out.stats.twoColumnLinesSplit).toBe(2);
    expect(out.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ fullName: 'Ali, Jaidaa', clubName: '4LSA', timeDisplay: '2:30.48' }),
      expect.objectContaining({ fullName: 'Ahemd Kheira, Haya', clubName: 'Msc Dubai', timeDisplay: '2:21.71' }),
      expect.objectContaining({ fullName: 'Sytnik, Alisa', clubName: 'Hamilton', timeDisplay: '2:21.98' }),
    ]));
  });
});
