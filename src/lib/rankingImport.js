/**
 * SWIMMERS RANKING — Import logic  (Phase 3a, pure/testable)
 * =====================================================================
 * The framework-free core of the import → review → approve flow:
 *   - normalize names/clubs for matching + dedup
 *   - SHA-256 (file dedup guard + result natural-key)
 *   - map parser output → ranking_staging_results payloads
 *   - match each staged swimmer against the persistent ranking_swimmers
 *     registry with Jaro-Winkler (+ gender lock, + club boost)
 *   - compute the natural-key hash that dedups a re-uploaded swim
 *
 * All Supabase / browser wiring lives in rankingImportApi.js — this module
 * has no side effects so it can be unit-tested against the real sample data.
 * =====================================================================
 */
import jaroWinkler from 'jaro-winkler';

/* ---------------- normalization ---------------- */

/** Lowercase, strip punctuation, collapse whitespace. */
export function normalizeName(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[.,'`’-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Club/team normalization — same rules; kept separate for clarity/intent. */
export function normalizeClub(s) {
  return normalizeName(s);
}

/* ---------------- club resolution (alias + merge) ---------------- */

/**
 * Build a resolver from the ranking_clubs registry. It maps every KNOWN spelling
 * of a club — each club's own normalized_name AND every recorded alias — to the
 * id of the surviving CANONICAL club, following canonical_club_id when a club was
 * merged away (with cycle/chain protection). So once an admin merges "Hamilton"
 * into "Hamilton Aquatics Dubai", both spellings resolve to the same id and the
 * club stops fragmenting on future imports.
 *
 * @param {Array<{id,name,normalized_name,aliases,canonical_club_id}>} clubs
 * @returns {Map<string,string>} normalized spelling -> canonical club id
 */
export function buildClubIndex(clubs) {
  const list = clubs || [];
  const byId = new Map(list.map((c) => [c.id, c]));

  // Follow the merge chain to the surviving club (guard against broken/looping refs).
  const canonicalIdOf = (club) => {
    let cur = club;
    const seen = new Set();
    while (cur && cur.canonical_club_id && !seen.has(cur.id)) {
      seen.add(cur.id);
      cur = byId.get(cur.canonical_club_id) || null;
    }
    return cur ? cur.id : club.id;
  };

  const map = new Map();
  // Pass 1: a club's OWN name is authoritative — it always wins.
  for (const c of list) {
    const key = normalizeClub(c.normalized_name);
    if (key) map.set(key, canonicalIdOf(c));
  }
  // Pass 2: aliases fill in spellings not already claimed by some club's own name.
  for (const c of list) {
    const cid = canonicalIdOf(c);
    for (const a of (Array.isArray(c.aliases) ? c.aliases : [])) {
      const key = normalizeClub(a);
      if (key && !map.has(key)) map.set(key, cid);
    }
  }
  return map;
}

/** Resolve a raw club name to a canonical club id via the index, or null if unknown. */
export function resolveClubId(rawName, clubIndex) {
  const key = normalizeClub(rawName);
  if (!key) return null;
  return clubIndex.get(key) || null;
}

/* ---------------- hashing ---------------- */

/**
 * SHA-256 → lowercase hex. Accepts a string or an ArrayBuffer/TypedArray.
 * Uses Web Crypto (present in browsers and Node ≥ 20 as globalThis.crypto).
 */
export async function sha256Hex(input) {
  let bytes;
  if (typeof input === 'string') {
    bytes = new TextEncoder().encode(input);
  } else if (input instanceof ArrayBuffer) {
    bytes = new Uint8Array(input);
  } else {
    bytes = input; // assume a TypedArray/Uint8Array
  }
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Stable string identifying one unique swim, independent of DB ids, so the
 * same result re-uploaded hashes identically and the (org_id, natural_key_hash)
 * unique constraint blocks the duplicate. Meet identity is folded in so the
 * same swimmer/time at two different meets are NOT collapsed.
 */
export function naturalKeyString(row, meet) {
  const meetKey = [
    normalizeName(meet?.name || ''),
    meet?.startDate || '',
    (row.courseType || row.course_type || '').toUpperCase(),
  ].join('~');
  return [
    normalizeName(row.fullName || row.full_name || ''),
    (row.gender || '').toUpperCase(),
    (row.stroke || '').toLowerCase(),
    row.distance ?? '',
    (row.courseType || row.course_type || '').toUpperCase(),
    row.ageAtSwim ?? row.age_at_swim ?? '',
    row.timeMs ?? row.time_ms ?? '',
    meetKey,
  ].join('|');
}

/** natural_key_hash for a ranking_results row. */
export function computeNaturalKey(row, meet) {
  return sha256Hex(naturalKeyString(row, meet));
}

/* ---------------- swimmer matching ---------------- */

// Confidence bands (Jaro-Winkler on normalized full name, gender-locked).
export const MATCH_AUTO = 0.93;   // ≥ → auto-link, no review needed
export const MATCH_REVIEW = 0.85; // ≥ (and < AUTO) → link but flag for review
// < MATCH_REVIEW → treat as a NEW swimmer (also flagged for review)

/**
 * Build a fast lookup index from the ranking_swimmers registry.
 * A merged-away (tombstoned) swimmer keeps its spelling in the index but points
 * at the surviving `canonical_swimmer_id`, so a future import of the old spelling
 * resolves straight to the kept swimmer — the merge is remembered.
 * @param {Array<{id,full_name,normalized_name,gender,current_club_id,canonical_swimmer_id?}>} swimmers
 */
export function buildSwimmerIndex(swimmers) {
  return (swimmers || []).map(s => ({
    id: s.canonical_swimmer_id || s.id,
    normalized: s.normalized_name || normalizeName(s.full_name),
    gender: (s.gender || '').toUpperCase(),
    clubId: s.current_club_id || null,
  }));
}

/**
 * Match one staged row against the registry.
 * @returns {{ matchedSwimmerId: string|null, confidence: number,
 *             needsReview: boolean, reviewReason: string|null, isNew: boolean }}
 */
export function matchSwimmerRow(row, swimmerIndex) {
  const name = normalizeName(row.fullName || row.full_name || '');
  const gender = (row.gender || '').toUpperCase();
  if (!name) {
    return { matchedSwimmerId: null, confidence: 0, needsReview: true,
             reviewReason: 'missing name', isNew: true };
  }

  let best = null;
  let bestScore = 0;
  for (const cand of swimmerIndex) {
    // Gender lock: never match across a known gender boundary.
    if (gender && cand.gender && gender !== cand.gender) continue;
    const score = jaroWinkler(name, cand.normalized);
    if (score > bestScore) { bestScore = score; best = cand; }
  }

  if (best && bestScore >= MATCH_AUTO) {
    return { matchedSwimmerId: best.id, confidence: round2(bestScore),
             needsReview: false, reviewReason: null, isNew: false };
  }
  if (best && bestScore >= MATCH_REVIEW) {
    return { matchedSwimmerId: best.id, confidence: round2(bestScore),
             needsReview: true, reviewReason: `possible match (${round2(bestScore)}) — confirm`,
             isNew: false };
  }
  return { matchedSwimmerId: null, confidence: round2(bestScore),
           needsReview: true,
           reviewReason: best ? `no confident match (best ${round2(bestScore)}) — will create new swimmer`
                              : 'new swimmer',
           isNew: true };
}

function round2(n) { return Math.round(n * 100) / 100; }

/* ---------------- staging payloads ---------------- */

/**
 * Map parser output rows → ranking_staging_results insert payloads (snake_case).
 * Pure mapping only; matching is applied separately via applyMatches().
 *
 * @param {Array} results    processResultRows(...).results
 * @param {{ batchId:string, courseType:'SC'|'LC', season?:number }} ctx
 */
export function buildStagingRows(results, ctx) {
  return (results || []).map(r => ({
    batch_id: ctx.batchId,
    // raw (correction grid)
    raw_name: r.rawName ?? r.fullName ?? null,
    raw_team: r.rawTeam ?? r.clubName ?? null,
    raw_time: r.rawTime ?? r.timeDisplay ?? null,
    // parsed / correctable
    full_name: r.fullName ?? null,
    club_name: r.clubName ?? null,
    gender: r.gender ?? null,
    stroke: r.stroke ?? null,
    distance: r.distance ?? null,
    course_type: ctx.courseType ?? r.courseType ?? r.courseTypeHint ?? null,
    age_at_swim: r.ageAtSwim ?? null,
    age_group_label: r.ageGroupLabel ?? (r.ageAtSwim != null ? `${r.ageAtSwim} Year Olds` : null),
    swim_date: r.swimDate ?? null,
    season: ctx.season ?? r.season ?? null,
    time_ms: r.timeMs ?? null,
    time_display: r.timeDisplay ?? null,
    finish_position: r.finishPosition ?? null,
    // matching (filled by applyMatches)
    matched_swimmer_id: null,
    match_confidence: null,
    needs_review: false,
    review_reason: null,
  }));
}

/**
 * Annotate staging rows with swimmer matches. Returns { rows, stats }.
 * Mutates a shallow copy — original array is left untouched.
 */
export function applyMatches(stagingRows, swimmerIndex) {
  const stats = { matched: 0, review: 0, newSwimmers: 0 };
  const rows = stagingRows.map(r => {
    const m = matchSwimmerRow({ full_name: r.full_name, gender: r.gender }, swimmerIndex);
    if (m.isNew) stats.newSwimmers++;
    else if (m.needsReview) stats.review++;
    else stats.matched++;
    return {
      ...r,
      matched_swimmer_id: m.matchedSwimmerId,
      match_confidence: m.confidence,
      needs_review: m.needsReview,
      review_reason: m.reviewReason,
    };
  });
  return { rows, stats };
}
