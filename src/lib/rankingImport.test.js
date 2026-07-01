import { describe, it, expect } from 'vitest';
import { processResultRows } from './rankingResultParser.js';
import {
  normalizeName,
  normalizeClub,
  buildClubIndex,
  resolveClubId,
  sha256Hex,
  naturalKeyString,
  computeNaturalKey,
  buildSwimmerIndex,
  matchSwimmerRow,
  buildStagingRows,
  applyMatches,
  MATCH_AUTO,
} from './rankingImport.js';

const SAMPLE_LINES = [
  'Open Swimming Championship - June 2026 - 27/06/2026 to 28/06/2026',
  'UAE Aquatics',
  'Event 301  Girls 10 Year Olds 200 LC Meter Freestyle',
  'Name Age Team Finals Time',
  '1 Olivia Limantara 10 SwimShark Swimming Training 2:57.71',
  '2 Alisa Kobozeva 10 ProActive Swimming Club 2:58.02',
  '3 Esther Bettles 10 Tyneside Swim Club 2:59.25',
];

describe('normalization', () => {
  it('lowercases, strips punctuation, collapses whitespace', () => {
    expect(normalizeName("Ellen van der Sluijs")).toBe('ellen van der sluijs');
    expect(normalizeName("O'Brien-Smith,  Jr.")).toBe('o brien smith jr');
    expect(normalizeClub('Tyneside  Swim Club')).toBe('tyneside swim club');
  });
});

describe('club resolution (alias + merge)', () => {
  // "Hamilton Aquatics Dubai" is the canonical club; "Hamilton" was merged into
  // it (tombstone with canonical_club_id + its name folded into aliases).
  const clubs = [
    { id: 'c-ham', name: 'Hamilton Aquatics Dubai', normalized_name: 'hamilton aquatics dubai',
      aliases: ['hamilton'], canonical_club_id: null },
    { id: 'c-ham-old', name: 'Hamilton', normalized_name: 'hamilton',
      aliases: [], canonical_club_id: 'c-ham' },
    { id: 'c-tyne', name: 'Tyneside Swim Club', normalized_name: 'tyneside swim club',
      aliases: [], canonical_club_id: null },
  ];
  const index = buildClubIndex(clubs);

  it('resolves the canonical name to its own id', () => {
    expect(resolveClubId('Hamilton Aquatics Dubai', index)).toBe('c-ham');
    expect(resolveClubId('Tyneside Swim Club', index)).toBe('c-tyne');
  });

  it('resolves a merged short-form (via alias AND via the tombstone) to the canonical id', () => {
    expect(resolveClubId('Hamilton', index)).toBe('c-ham');   // not the tombstone c-ham-old
    expect(resolveClubId('  hamilton  ', index)).toBe('c-ham'); // normalization applied
  });

  it('a club own-name wins over an alias pointing elsewhere', () => {
    // If some club aliased "tyneside swim club", the real club still owns it.
    const withClash = [
      ...clubs,
      { id: 'c-x', name: 'X', normalized_name: 'x', aliases: ['tyneside swim club'], canonical_club_id: null },
    ];
    expect(resolveClubId('Tyneside Swim Club', buildClubIndex(withClash))).toBe('c-tyne');
  });

  it('returns null for an unknown club (import will create it fresh)', () => {
    expect(resolveClubId('Brand New Aquatics', index)).toBeNull();
    expect(resolveClubId('', index)).toBeNull();
  });

  it('survives a broken/looping canonical chain without hanging', () => {
    const looped = [
      { id: 'a', name: 'A', normalized_name: 'a', aliases: [], canonical_club_id: 'b' },
      { id: 'b', name: 'B', normalized_name: 'b', aliases: [], canonical_club_id: 'a' },
    ];
    // Should terminate and return *some* id, not loop forever.
    expect(['a', 'b']).toContain(resolveClubId('A', buildClubIndex(looped)));
  });
});

describe('sha256 + natural key', () => {
  it('produces a stable 64-hex-char digest', async () => {
    const h = await sha256Hex('hello');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('same swim → same natural key; different meet → different key', async () => {
    const meetA = { name: 'Open Swimming Championship', startDate: '2026-06-27' };
    const meetB = { name: 'Winter Cup', startDate: '2026-12-01' };
    const row = { fullName: 'Olivia Limantara', gender: 'F', stroke: 'Freestyle',
                  distance: 200, courseType: 'LC', ageAtSwim: 10, timeMs: 177710 };
    const k1 = await computeNaturalKey(row, meetA);
    const k2 = await computeNaturalKey(row, meetA);
    const k3 = await computeNaturalKey(row, meetB);
    expect(k1).toBe(k2);           // idempotent → dedup works on re-upload
    expect(k1).not.toBe(k3);       // same swimmer/time, different meet → distinct
  });

  it('natural key string folds in meet + event identity', () => {
    const s = naturalKeyString(
      { fullName: 'Olivia Limantara', gender: 'F', stroke: 'Freestyle', distance: 200,
        courseType: 'LC', ageAtSwim: 10, timeMs: 177710 },
      { name: 'Open Swimming Championship', startDate: '2026-06-27' });
    expect(s).toContain('olivia limantara');
    expect(s).toContain('177710');
    expect(s).toContain('open swimming championship');
  });
});

describe('swimmer matching (Jaro-Winkler, gender-locked)', () => {
  const registry = [
    { id: 'sw-1', full_name: 'Olivia Limantara', normalized_name: 'olivia limantara', gender: 'F' },
    { id: 'sw-2', full_name: 'Oliver Limantara', normalized_name: 'oliver limantara', gender: 'M' },
    { id: 'sw-3', full_name: 'Esther Bettles', normalized_name: 'esther bettles', gender: 'F' },
  ];
  const index = buildSwimmerIndex(registry);

  it('auto-links an exact name+gender match', () => {
    const m = matchSwimmerRow({ full_name: 'Olivia Limantara', gender: 'F' }, index);
    expect(m).toMatchObject({ matchedSwimmerId: 'sw-1', needsReview: false, isNew: false });
    expect(m.confidence).toBeGreaterThanOrEqual(MATCH_AUTO);
  });

  it('never matches across a gender boundary', () => {
    // "Oliver Limantara" (M) is a near-identical string but wrong gender for an F row
    const m = matchSwimmerRow({ full_name: 'Olivia Limantara', gender: 'F' }, index);
    expect(m.matchedSwimmerId).toBe('sw-1'); // the F one, not sw-2
  });

  it('treats an unknown name as a new swimmer needing review', () => {
    const m = matchSwimmerRow({ full_name: 'Brand New Person', gender: 'F' }, index);
    expect(m.isNew).toBe(true);
    expect(m.needsReview).toBe(true);
    expect(m.matchedSwimmerId).toBeNull();
  });

  it('flags a fuzzy-but-not-certain match for review', () => {
    // "Esta Bettles" vs "Esther Bettles" → JW ≈ 0.87, inside [0.85, 0.93):
    // close enough to link, not close enough to trust blindly.
    const m = matchSwimmerRow({ full_name: 'Esta Bettles', gender: 'F' }, index);
    expect(m.matchedSwimmerId).toBe('sw-3');
    expect(m.needsReview).toBe(true);
    expect(m.isNew).toBe(false);
  });

  it('redirects a merged-away (tombstoned) spelling to the surviving swimmer', () => {
    // "Olivia L" was merged INTO sw-1; its spelling must now resolve to sw-1,
    // not re-create or match the tombstone, so the merge sticks on re-import.
    const withTombstone = buildSwimmerIndex([
      ...registry,
      { id: 'sw-9', full_name: 'Olivia L', normalized_name: 'olivia l', gender: 'F', canonical_swimmer_id: 'sw-1' },
    ]);
    const m = matchSwimmerRow({ full_name: 'Olivia L', gender: 'F' }, withTombstone);
    expect(m.matchedSwimmerId).toBe('sw-1');
  });
});

describe('staging payloads', () => {
  const out = processResultRows(SAMPLE_LINES, { courseType: 'LC' });

  it('maps parser rows to snake_case staging columns', () => {
    const rows = buildStagingRows(out.results, { batchId: 'batch-1', courseType: 'LC', season: 2026 });
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      batch_id: 'batch-1',
      full_name: 'Olivia Limantara',
      club_name: 'SwimShark Swimming Training',
      gender: 'F',
      stroke: 'Freestyle',
      distance: 200,
      course_type: 'LC',
      age_at_swim: 10,
      age_group_label: '10 Year Olds',
      season: 2026,
      time_ms: 177710,
      time_display: '2:57.71',
      finish_position: 1,
      raw_name: 'Olivia Limantara',
      raw_time: '2:57.71',
    });
  });

  it('applyMatches annotates rows and tallies stats', () => {
    const rows = buildStagingRows(out.results, { batchId: 'b', courseType: 'LC', season: 2026 });
    const registry = [
      { id: 'sw-1', full_name: 'Olivia Limantara', normalized_name: 'olivia limantara', gender: 'F' },
    ];
    const { rows: annotated, stats } = applyMatches(rows, buildSwimmerIndex(registry));
    // Olivia auto-matches; Alisa + Esther are new
    expect(stats.matched).toBe(1);
    expect(stats.newSwimmers).toBe(2);
    expect(annotated[0].matched_swimmer_id).toBe('sw-1');
    expect(annotated[0].needs_review).toBe(false);
    expect(annotated[1].matched_swimmer_id).toBeNull();
    expect(annotated[1].needs_review).toBe(true);
  });

  it('does not mutate the input rows', () => {
    const rows = buildStagingRows(out.results, { batchId: 'b', courseType: 'LC' });
    const before = rows[0].matched_swimmer_id;
    applyMatches(rows, buildSwimmerIndex([]));
    expect(rows[0].matched_swimmer_id).toBe(before); // still null on the original
  });
});
