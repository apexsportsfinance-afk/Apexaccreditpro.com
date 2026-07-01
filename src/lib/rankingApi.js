/**
 * SWIMMERS RANKING — Rankings + Settings API  (Phase 4)
 * =====================================================================
 * Read side of the ranking domain (the Rankings tab) plus World Aquatics
 * base-time management (the Settings tab). Import/review/approve lives in
 * rankingImportApi.js; this module only READS ranking_best_times /
 * ranking_event_index and CRUDs ranking_wa_base_times.
 *
 * The ranking itself is DERIVED in SQL (ranking_best_times): for each
 * (gender, age_at_swim, stroke, distance, course_type) it keeps every
 * swimmer's fastest all-time swim, ranks them 1..N, and attaches WA points
 * from the newest matching base time. So the Rankings tab is just a filtered,
 * ordered SELECT — no ranking math in the browser.
 * =====================================================================
 */
import { supabase } from './supabase';
import { normalizeName } from './rankingImport';

const BEST_TIMES_VIEW = 'ranking_best_times';
const EVENT_INDEX_VIEW = 'ranking_event_index';
const CLUB_TABLE = 'ranking_clubs';
const WA_TABLE = 'ranking_wa_base_times';
const SWIMMER_TABLE = 'ranking_swimmers';
const SWIMMER_STATS_VIEW = 'ranking_swimmer_stats';
const RESULT_TABLE = 'ranking_results';
const STAGING_TABLE = 'ranking_staging_results';

/** Throw on a Supabase error, else return data. */
function ok(resp, context) {
  if (resp.error) {
    console.error(`[Ranking] ${context}:`, resp.error);
    throw resp.error;
  }
  return resp.data;
}

export const RankingAPI = {
  /* ------------------------------------------------------------------ *
   * RANKINGS (read-only, derived)
   * ------------------------------------------------------------------ */

  /**
   * The distinct events that actually have results, for the filter dropdowns.
   * @returns rows of { gender, age_at_swim, age_group_label, stroke, distance,
   *                    course_type, swimmer_count, result_count, first/last_season }
   */
  listEvents: async () =>
    ok(await supabase.from(EVENT_INDEX_VIEW)
      .select('*')
      .order('course_type', { ascending: true })
      .order('gender', { ascending: true })
      .order('stroke', { ascending: true })
      .order('distance', { ascending: true })
      .order('age_at_swim', { ascending: true }),
      'list events'),

  /** Canonical clubs (merged-away tombstones hidden), for the club filter. */
  listClubOptions: async () =>
    ok(await supabase.from(CLUB_TABLE)
      .select('id, name, canonical_club_id')
      .is('canonical_club_id', null)
      .order('name', { ascending: true }),
      'list club options'),

  /**
   * Fetch one event's ranking, ordered by rank (1..N). An event is the full
   * (gender, ageAtSwim, stroke, distance, courseType) tuple — that's what the
   * rank is computed over. `clubId` optionally narrows the rows to one club
   * while KEEPING each swimmer's true all-time rank_position. Pages past
   * Supabase's 1000-row cap so a huge event isn't silently truncated.
   *
   * @param {{ gender, ageAtSwim, stroke, distance, courseType, clubId? }} f
   */
  listRankings: async (f = {}) => {
    const { gender, ageAtSwim, stroke, distance, courseType, clubId } = f;
    if (!gender || !stroke || !distance || !courseType || ageAtSwim == null) {
      // A rank only means something within a full event partition.
      throw new Error('Pick gender, age, stroke, distance and course to see a ranking.');
    }
    const PAGE = 1000;
    let from = 0;
    let all = [];
    for (;;) {
      let q = supabase.from(BEST_TIMES_VIEW)
        .select('*')
        .eq('gender', gender)
        .eq('age_at_swim', ageAtSwim)
        .eq('stroke', stroke)
        .eq('distance', distance)
        .eq('course_type', courseType);
      if (clubId) q = q.eq('club_id', clubId);
      const data = ok(
        await q.order('rank_position', { ascending: true })
          .order('best_time_ms', { ascending: true })
          .range(from, from + PAGE - 1),
        'list rankings',
      );
      all = all.concat(data || []);
      if (!data || data.length < PAGE) break;
      from += PAGE;
    }
    return all;
  },

  /* ------------------------------------------------------------------ *
   * WORLD AQUATICS BASE TIMES (Settings tab)
   * ------------------------------------------------------------------ */

  listBaseTimes: async () =>
    ok(await supabase.from(WA_TABLE)
      .select('*')
      .order('year', { ascending: false })
      .order('course_type', { ascending: true })
      .order('gender', { ascending: true })
      .order('stroke', { ascending: true })
      .order('distance', { ascending: true }),
      'list base times'),

  /**
   * Insert or update one base time. Uniqueness is (org_id, gender, course_type,
   * stroke, distance, year), so re-entering the same event/year overwrites the
   * base_time_ms instead of erroring. org_id is auto-filled by the insert trigger.
   */
  upsertBaseTime: async (row) => {
    const payload = {
      gender: row.gender,
      course_type: row.course_type,
      stroke: row.stroke,
      distance: row.distance,
      base_time_ms: row.base_time_ms,
      year: row.year,
    };
    if (row.id) {
      return ok(await supabase.from(WA_TABLE).update(payload).eq('id', row.id).select().single(),
        'update base time');
    }
    return ok(await supabase.from(WA_TABLE)
      .upsert(payload, { onConflict: 'org_id,gender,course_type,stroke,distance,year' })
      .select().single(),
      'upsert base time');
  },

  deleteBaseTime: async (id) =>
    ok(await supabase.from(WA_TABLE).delete().eq('id', id), 'delete base time'),

  /* ------------------------------------------------------------------ *
   * SWIMMERS (registry + profiles)
   * ------------------------------------------------------------------ */

  /**
   * The swimmer registry with per-swimmer tallies (club, swims, meets, events).
   * @param {{ search?:string, verified?:'yes'|'no' }} f
   */
  listSwimmers: async (f = {}) => {
    let q = supabase.from(SWIMMER_STATS_VIEW).select('*');
    if (f.search && f.search.trim()) q = q.ilike('full_name', `%${f.search.trim()}%`);
    if (f.verified === 'yes') q = q.eq('is_verified', true);
    if (f.verified === 'no') q = q.eq('is_verified', false);
    return ok(
      await q.order('result_count', { ascending: false }).order('full_name', { ascending: true }),
      'list swimmers',
    );
  },

  /** One swimmer's personal bests (fastest per event, with rank + WA points). */
  getSwimmerBests: async (swimmerId) =>
    ok(await supabase.from(BEST_TIMES_VIEW)
      .select('*')
      .eq('swimmer_id', swimmerId)
      .order('course_type', { ascending: true })
      .order('stroke', { ascending: true })
      .order('distance', { ascending: true }),
      'swimmer bests'),

  /** One swimmer's full swim history (every result), newest meet first. */
  getSwimmerHistory: async (swimmerId) =>
    ok(await supabase.from(RESULT_TABLE)
      .select('*, ranking_meets(name, start_date), ranking_clubs(name)')
      .eq('swimmer_id', swimmerId)
      .order('swim_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false }),
      'swimmer history'),

  /**
   * Edit a swimmer's identity. A name change also refreshes normalized_name so
   * future imports match the corrected spelling. Only the given fields change.
   * @param {{ full_name?, gender?, is_verified? }} patch
   */
  updateSwimmer: async (id, patch) => {
    const p = {};
    if (patch.full_name != null) { p.full_name = patch.full_name.trim(); p.normalized_name = normalizeName(patch.full_name); }
    if (patch.gender !== undefined) p.gender = patch.gender || null;
    if (patch.is_verified !== undefined) p.is_verified = !!patch.is_verified;
    if (!Object.keys(p).length) throw new Error('Nothing to update.');
    return ok(await supabase.from(SWIMMER_TABLE).update(p).eq('id', id).select().single(), 'update swimmer');
  },

  /**
   * Merge `loserId` into `winnerId`: repoint every result + staging match to the
   * winner, then tombstone the loser (canonical_swimmer_id → winner) so the
   * matcher redirects the loser's spelling to the winner on future imports.
   * Chains collapse straight to the survivor. Repointing is hash-safe — the
   * result natural key is name+event+meet+time, not swimmer_id.
   */
  mergeSwimmers: async (loserId, winnerId) => {
    if (!loserId || !winnerId) throw new Error('Pick two swimmers to merge.');
    if (loserId === winnerId) throw new Error('Cannot merge a swimmer into itself.');
    // Repoint history + pending staging matches from the loser to the winner.
    ok(await supabase.from(RESULT_TABLE).update({ swimmer_id: winnerId }).eq('swimmer_id', loserId),
      'merge: repoint results');
    ok(await supabase.from(STAGING_TABLE).update({ matched_swimmer_id: winnerId }).eq('matched_swimmer_id', loserId),
      'merge: repoint staging matches');
    // Tombstone the loser, and collapse anything previously merged INTO it.
    ok(await supabase.from(SWIMMER_TABLE).update({ canonical_swimmer_id: winnerId }).eq('id', loserId),
      'merge: tombstone loser');
    ok(await supabase.from(SWIMMER_TABLE).update({ canonical_swimmer_id: winnerId }).eq('canonical_swimmer_id', loserId),
      'merge: collapse chain');
    return { into: winnerId };
  },
};
