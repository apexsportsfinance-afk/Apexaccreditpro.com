/**
 * SWIMMERS RANKING — Import API  (Phase 3b)
 * =====================================================================
 * Self-contained Supabase wiring for the import → review → approve →
 * (reverse) lifecycle. Talks ONLY to the ranking_* tables. org_id is
 * auto-filled by the BEFORE INSERT trigger (ranking_set_org_id), so the
 * client never sends it; restrictive RLS keeps every read/write tenant-scoped.
 *
 * Flow:
 *   importFiles()   parse PDFs → dedup by SHA-256 → stage rows (status 'review')
 *   [review UI]     getStagingRows / updateStagingRow / deleteStagingRow
 *   approveBatch()  ensure clubs+swimmers, promote staging → ranking_results
 *                   (dedup on natural_key_hash), status 'approved'
 *   reverseBatch()  delete this batch's ranking_results, status 'reversed'
 *
 * The heavy PDF parser is dynamically imported so it never lands in bundles
 * that don't need it (mirrors CallRoomAPI). Pure logic lives in
 * rankingImport.js / rankingResultParser.js and is unit-tested there.
 * =====================================================================
 */
import { supabase } from './supabase';
import {
  normalizeName,
  normalizeClub,
  sha256Hex,
  computeNaturalKey,
  buildSwimmerIndex,
  buildClubIndex,
  buildStagingRows,
  applyMatches,
} from './rankingImport';

const CLUB_TABLE = 'ranking_clubs';
const CLUB_STATS_VIEW = 'ranking_club_stats';
const SWIMMER_TABLE = 'ranking_swimmers';
const MEET_TABLE = 'ranking_meets';
const BATCH_TABLE = 'ranking_import_batches';
const FILE_TABLE = 'ranking_import_files';
const STAGING_TABLE = 'ranking_staging_results';
const RESULT_TABLE = 'ranking_results';

async function currentUserId() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

/** Throw on a Supabase error, else return data. */
function ok(resp, context) {
  if (resp.error) {
    console.error(`[RankingImport] ${context}:`, resp.error);
    throw resp.error;
  }
  return resp.data;
}

export const RankingImportAPI = {
  /* ------------------------------------------------------------------ *
   * IMPORT
   * ------------------------------------------------------------------ */

  /**
   * Parse one or more result PDFs and stage them for review.
   * @param {File[]} files
   * @param {{ courseType:'SC'|'LC', season?:number, meetInfo?:object }} opts
   * @returns {{ batches:Array, stats, warnings, duplicateFiles, batchId }}
   *
   * Each PDF is its OWN meet → its own batch. Bulk-uploading 20 files makes 20
   * reviewable/approvable batches, NOT one giant blob. (Folding many meets into
   * one also broke dedup: the natural key folds in meet identity, so the same
   * swimmer at two real meets would collapse to a single key and drop a result.)
   */
  importFiles: async (files, opts = {}) => {
    const { courseType, season = null, meetInfo = {} } = opts;
    if (!courseType) throw new Error('courseType (SC/LC) is required at upload time.');
    if (!files || !files.length) throw new Error('No files provided.');

    const { parseRankingResultPdf } = await import('./rankingResultParser');
    const uploadedBy = await currentUserId();

    // Match against the already-approved swimmer registry once (staging never
    // creates swimmers, so the registry can't change mid-import).
    const registry = ok(
      await supabase.from(SWIMMER_TABLE).select('id, full_name, normalized_name, gender, current_club_id, canonical_swimmer_id'),
      'load swimmer registry',
    );
    const index = buildSwimmerIndex(registry);

    const batches = [];          // one entry per file that produced a batch
    const duplicateFiles = [];
    const warnings = [];
    // The optional meet-name override only makes sense for a single-file upload —
    // it must never stamp 20 different meets with one name.
    const singleFile = files.length === 1;

    for (const file of files) {
      // Each file is isolated: one bad PDF must never abort the others or leave a
      // half-created batch stuck at 'extracting'. On any failure we delete the
      // partial batch and record a warning, then move on.
      let batchId = null;
      try {
        const buf = await file.arrayBuffer();
        const fileHash = await sha256Hex(buf);

        // Skip an identical PDF BEFORE creating a batch, so dupes leave no empty batch.
        const existing = ok(
          await supabase.from(FILE_TABLE).select('id, file_name').eq('file_sha256', fileHash).maybeSingle(),
          'dup-check file',
        );
        if (existing) {
          duplicateFiles.push({ fileName: file.name, reason: 'identical file already imported' });
          continue;
        }

        let parsed, parseStatus = 'ok', errorDetail = null;
        const fileWarnings = [];
        try {
          parsed = await parseRankingResultPdf(new File([buf], file.name, { type: file.type || 'application/pdf' }),
            { courseType, season });
          (parsed.warnings || []).forEach(w => fileWarnings.push(`${file.name}: ${w}`));
        } catch (e) {
          parseStatus = 'error';
          errorDetail = e?.message || String(e);
          fileWarnings.push(`${file.name}: parse failed — ${errorDetail}`);
        }
        warnings.push(...fileWarnings);

        // One batch per file.
        const batch = ok(
          await supabase.from(BATCH_TABLE).insert({
            uploaded_by: uploadedBy, status: 'extracting', course_type: courseType, season,
          }).select('id').single(),
          'create batch',
        );
        batchId = batch.id;

        ok(
          await supabase.from(FILE_TABLE).insert({
            batch_id: batchId, file_name: file.name, file_sha256: fileHash,
            page_count: parsed?.stats?.pageCount ?? null, parse_status: parseStatus, error_detail: errorDetail,
          }).select('id').single(),
          'record file',
        );

        // Meet name comes from THIS file's header; fall back to the filename so a
        // headerless file is still recognizable in the batch list.
        const meetName = ((singleFile && meetInfo.name) || parsed?.meet?.name
          || file.name.replace(/\.pdf$/i, '')).trim();
        const results = parsed?.results || [];

        if (!results.length) {
          ok(await supabase.from(BATCH_TABLE).update({
            status: 'review', results_imported: 0, errors_count: fileWarnings.length, duplicates_skipped: 0,
          }).eq('id', batchId), 'finalize empty batch');
          batches.push({ batchId, meetName, fileName: file.name,
            resultsParsed: 0, matched: 0, needingReview: 0, newSwimmers: 0 });
          continue;
        }

        const meetId = await RankingImportAPI._findOrCreateMeet({
          name: meetName,
          courseType,
          startDate: (singleFile && meetInfo.startDate) || parsed.meet?.startDate || null,
          endDate: (singleFile && meetInfo.endDate) || parsed.meet?.endDate || null,
          season: season || parsed.meet?.season || null,
          sanctioningBody: (singleFile && meetInfo.sanctioningBody) || parsed.meet?.sanctioningBody || null,
        });
        ok(await supabase.from(BATCH_TABLE).update({ meet_id: meetId }).eq('id', batchId), 'link meet');

        // Stage in chunks — a big meet is thousands of rows and one giant insert
        // can hit PostgREST payload/timeout limits (which was leaving orphans).
        const staged = buildStagingRows(results, { batchId, courseType, season });
        const { rows: annotated, stats: matchStats } = applyMatches(staged, index);
        const CHUNK = 500;
        for (let i = 0; i < annotated.length; i += CHUNK) {
          ok(await supabase.from(STAGING_TABLE).insert(annotated.slice(i, i + CHUNK)), 'insert staging rows');
        }
        ok(await supabase.from(BATCH_TABLE).update({
          status: 'review',
          results_imported: results.length,
          errors_count: fileWarnings.length,
          duplicates_skipped: 0,
          swimmers_matched: matchStats.matched,
          swimmers_needing_review: matchStats.review + matchStats.newSwimmers,
        }).eq('id', batchId), 'finalize batch');

        batches.push({ batchId, meetId, meetName, fileName: file.name,
          resultsParsed: results.length, matched: matchStats.matched,
          needingReview: matchStats.review, newSwimmers: matchStats.newSwimmers });
      } catch (e) {
        // Isolate the failure: bin the partial batch (cascades its file+rows) so
        // no 'extracting' orphan is left, and surface which file failed.
        warnings.push(`${file.name}: import failed — ${e?.message || String(e)}`);
        if (batchId) {
          try { await supabase.from(BATCH_TABLE).delete().eq('id', batchId); } catch { /* best effort */ }
        }
      }
    }

    const stats = batches.reduce((a, b) => ({
      resultsParsed: a.resultsParsed + b.resultsParsed,
      matched: a.matched + b.matched,
      needingReview: a.needingReview + b.needingReview,
      newSwimmers: a.newSwimmers + b.newSwimmers,
    }), { resultsParsed: 0, matched: 0, needingReview: 0, newSwimmers: 0 });

    // batchId kept for callers that open a single batch after import (the first).
    return { batches, stats, warnings, duplicateFiles, batchId: batches[0]?.batchId || null };
  },

  _findOrCreateMeet: async (meet) => {
    // Match on name + course + date. start_date is often null (headerless file);
    // `.eq(col, null)` is NOT a null-safe match, so branch to `.is()`. Use
    // limit(1) rather than maybeSingle() so a pre-existing duplicate meet reuses
    // one instead of throwing.
    let q = supabase.from(MEET_TABLE).select('id')
      .eq('name', meet.name)
      .eq('course_type', meet.courseType);
    q = meet.startDate ? q.eq('start_date', meet.startDate) : q.is('start_date', null);
    const found = ok(await q.limit(1), 'find meet');
    if (found && found.length) return found[0].id;
    const created = ok(
      await supabase.from(MEET_TABLE).insert({
        name: meet.name,
        course_type: meet.courseType,
        start_date: meet.startDate,
        end_date: meet.endDate,
        season: meet.season,
        sanctioning_body: meet.sanctioningBody,
      }).select('id').single(),
      'create meet',
    );
    return created.id;
  },

  /* ------------------------------------------------------------------ *
   * REVIEW
   * ------------------------------------------------------------------ */

  listBatches: async () =>
    ok(await supabase.from(BATCH_TABLE)
      .select('*, ranking_meets(name, course_type, start_date)')
      .order('uploaded_at', { ascending: false }),
      'list batches'),

  getBatch: async (batchId) =>
    ok(await supabase.from(BATCH_TABLE)
      .select('*, ranking_meets(name, course_type, start_date, end_date)')
      .eq('id', batchId).single(),
      'get batch'),

  // Files that made up a batch (name, page count, parse status, error) — the
  // audit detail behind the Import Logs tab.
  getBatchFiles: async (batchId) =>
    ok(await supabase.from(FILE_TABLE)
      .select('id, file_name, page_count, parse_status, error_detail, file_sha256, created_at')
      .eq('batch_id', batchId)
      .order('created_at', { ascending: true }),
      'get batch files'),

  // Fetch EVERY staged row, paging past Supabase's 1000-row/request cap — a big
  // meet easily exceeds it, and approveBatch relies on this returning all rows
  // (a silent cap would drop results on publish). Ordered by event signature
  // (gender/stroke/distance/age) then finish position so a meet's rows group
  // together for review instead of scattering all 1st-places to the top.
  getStagingRows: async (batchId) => {
    const PAGE = 1000;
    let from = 0;
    let all = [];
    for (;;) {
      const data = ok(
        await supabase.from(STAGING_TABLE)
          .select('*, ranking_swimmers(full_name, gender)')
          .eq('batch_id', batchId)
          .order('gender', { ascending: true })
          .order('stroke', { ascending: true })
          .order('distance', { ascending: true })
          .order('age_at_swim', { ascending: true })
          .order('finish_position', { ascending: true })
          .range(from, from + PAGE - 1),
        'get staging rows',
      );
      all = all.concat(data || []);
      if (!data || data.length < PAGE) break;
      from += PAGE;
    }
    return all;
  },

  updateStagingRow: async (rowId, patch) =>
    ok(await supabase.from(STAGING_TABLE).update(patch).eq('id', rowId).select().single(),
      'update staging row'),

  /**
   * Rename a club across a whole batch: set club_name = `toName` on every staging
   * row currently spelled exactly `fromName`. This is the review-time equivalent of
   * "fix one club → all its swimmers update" — the same club is spelled full in one
   * meet and short in another, and the reviewer fixes it once for the batch.
   * Exact match on the stored spelling (rows sharing a club carry the identical
   * source string); different spellings stay distinct until unified via the Clubs tab.
   * Returns the ids of the rows that changed.
   */
  updateStagingClubName: async (batchId, fromName, toName) => {
    const from = (fromName ?? '').trim();
    const to = (toName ?? '').trim();
    if (!batchId) throw new Error('Missing batch.');
    // Match null/empty source club too, so a batch of blank clubs can be filled in bulk.
    let q = supabase.from(STAGING_TABLE).update({ club_name: to }).eq('batch_id', batchId);
    q = from ? q.eq('club_name', from) : q.or('club_name.is.null,club_name.eq.');
    return ok(await q.select('id'), 'bulk rename staging club');
  },

  deleteStagingRow: async (rowId) =>
    ok(await supabase.from(STAGING_TABLE).delete().eq('id', rowId), 'delete staging row'),

  /* ------------------------------------------------------------------ *
   * APPROVE — promote staging rows into immutable ranking_results
   * ------------------------------------------------------------------ */

  approveBatch: async (batchId) => {
    const batch = await RankingImportAPI.getBatch(batchId);
    if (batch.status === 'approved') throw new Error('Batch already approved.');
    const meet = {
      id: batch.meet_id,
      name: batch.ranking_meets?.name,
      startDate: batch.ranking_meets?.start_date,
    };
    const rows = await RankingImportAPI.getStagingRows(batchId);
    const usable = rows.filter(r => r.time_ms != null && r.full_name);
    if (!usable.length) throw new Error('No approvable rows (all missing a name or a valid time).');

    // 1. Ensure clubs (one lookup/insert per distinct normalized club name).
    const clubIdByNorm = await RankingImportAPI._ensureClubs(usable);

    // 2. Ensure swimmers: reuse matched ids; create the rest ONCE per
    //    (normalized name + gender) so a swimmer appearing twice isn't doubled.
    //    Seed from the CURRENT registry (exact normalized-name + gender) so the
    //    same swimmer imported across separate meets/batches reuses one identity
    //    instead of being recreated per meet — the point of a cross-event ranking.
    const swimmerIdByKey = new Map();
    const existingSwimmers = ok(
      await supabase.from(SWIMMER_TABLE).select('id, normalized_name, gender, canonical_swimmer_id'),
      'load swimmers for approve',
    );
    // Resolve any swimmer id through the merge tombstone to the surviving swimmer,
    // so a result never gets attached to a merged-away duplicate (whether it was
    // matched before the merge, or seeded from the registry below).
    const canonicalOf = (id) => {
      const seen = new Set();
      let cur = id;
      for (;;) {
        const s = existingSwimmers.find((x) => x.id === cur);
        if (!s || !s.canonical_swimmer_id || seen.has(cur)) return cur;
        seen.add(cur);
        cur = s.canonical_swimmer_id;
      }
    };
    for (const s of existingSwimmers) {
      if (s.canonical_swimmer_id) continue; // tombstones don't own a name key
      swimmerIdByKey.set(`${s.normalized_name}|${(s.gender || '').toUpperCase()}`, s.id);
    }
    for (const r of usable) {
      if (r.matched_swimmer_id) { swimmerIdByKey.set(swimmerKey(r), canonicalOf(r.matched_swimmer_id)); continue; }
      const key = swimmerKey(r);
      if (swimmerIdByKey.has(key)) continue;
      const clubId = clubIdByNorm.get(normalizeClub(r.club_name)) || null;
      const created = ok(
        await supabase.from(SWIMMER_TABLE).insert({
          full_name: r.full_name,
          normalized_name: normalizeName(r.full_name),
          gender: r.gender || null,
          current_club_id: clubId,
          is_verified: false,
        }).select('id').single(),
        'create swimmer',
      );
      swimmerIdByKey.set(key, created.id);
    }

    // 3. Build ranking_results rows (with natural-key dedup hash) and upsert.
    const resultRows = [];
    for (const r of usable) {
      const swimmerId = (r.matched_swimmer_id && canonicalOf(r.matched_swimmer_id)) || swimmerIdByKey.get(swimmerKey(r));
      const clubId = clubIdByNorm.get(normalizeClub(r.club_name)) || null;
      const naturalKeyHash = await computeNaturalKey(
        { fullName: r.full_name, gender: r.gender, stroke: r.stroke, distance: r.distance,
          courseType: r.course_type, ageAtSwim: r.age_at_swim, timeMs: r.time_ms }, meet);
      resultRows.push({
        swimmer_id: swimmerId,
        club_id: clubId,
        meet_id: meet.id,
        import_batch_id: batchId,
        gender: r.gender,
        stroke: r.stroke,
        distance: r.distance,
        course_type: r.course_type,
        age_at_swim: r.age_at_swim,
        age_group_label: r.age_group_label || `${r.age_at_swim} Year Olds`,
        swim_date: r.swim_date,
        season: r.season,
        time_ms: r.time_ms,
        time_display: r.time_display,
        finish_position: r.finish_position,
        natural_key_hash: naturalKeyHash,
      });
    }

    // Dedup on the natural key — re-approving or overlapping meets can't double-insert.
    // Chunk the upsert: a big meet is thousands of rows, and one giant request can
    // hit PostgREST payload/timeout limits. 500/request keeps each call small.
    const CHUNK = 500;
    for (let i = 0; i < resultRows.length; i += CHUNK) {
      ok(await supabase.from(RESULT_TABLE)
        .upsert(resultRows.slice(i, i + CHUNK),
          { onConflict: 'org_id,natural_key_hash', ignoreDuplicates: true }),
        'insert results');
    }

    ok(await supabase.from(BATCH_TABLE).update({
      status: 'approved', results_imported: resultRows.length,
    }).eq('id', batchId), 'mark approved');

    return { inserted: resultRows.length };
  },

  _ensureClubs: async (rows) => {
    // Load the whole club registry once and resolve incoming names through it
    // (own name + aliases + merge chain) so the SAME club under different
    // spellings ("Hamilton" vs "Hamilton Aquatics Dubai") consolidates onto ONE
    // canonical record instead of fragmenting. Unknown names are created fresh.
    const clubs = ok(
      await supabase.from(CLUB_TABLE).select('id, name, normalized_name, aliases, canonical_club_id'),
      'load clubs',
    );
    const index = buildClubIndex(clubs); // normalized spelling -> canonical id

    const map = new Map();       // normalized incoming -> canonical id (return value)
    const distinct = new Map();  // normalized -> original display name
    for (const r of rows) {
      const norm = normalizeClub(r.club_name);
      if (norm && !distinct.has(norm)) distinct.set(norm, r.club_name);
    }
    for (const [norm, display] of distinct) {
      const known = index.get(norm);
      if (known) { map.set(norm, known); continue; }
      const created = ok(
        await supabase.from(CLUB_TABLE).insert({ name: display, normalized_name: norm })
          .select('id').single(),
        'create club',
      );
      map.set(norm, created.id);
      index.set(norm, created.id); // a later identical spelling reuses it, no dup insert
    }
    return map;
  },

  /* ------------------------------------------------------------------ *
   * CLUBS — alias / merge management (Clubs tab)
   * ------------------------------------------------------------------ */

  // Canonical clubs only (merged-away tombstones hidden), with swim + swimmer
  // counts and their folded-in aliases. Ordered by usage so the busiest — the
  // one you'll usually keep as canonical — sits at the top.
  listClubs: async () =>
    ok(await supabase.from(CLUB_STATS_VIEW)
      .select('*')
      .is('canonical_club_id', null)
      .order('result_count', { ascending: false })
      .order('name', { ascending: true }),
      'list clubs'),

  /**
   * Merge `loserId` into `winnerId`: repoint every result + swimmer, fold the
   * loser's name/aliases into the winner's alias list (so future imports of the
   * old spelling auto-resolve), and tombstone the loser. Reversible via the
   * canonical_club_id pointer. Returns { into } for a follow-up refresh.
   */
  mergeClubs: async (loserId, winnerId) => {
    if (!loserId || !winnerId) throw new Error('Pick two clubs to merge.');
    if (loserId === winnerId) throw new Error('Cannot merge a club into itself.');
    const [loser, winner] = await Promise.all([
      ok(await supabase.from(CLUB_TABLE).select('id, name, aliases').eq('id', loserId).single(), 'merge: load loser'),
      ok(await supabase.from(CLUB_TABLE).select('id, name, aliases').eq('id', winnerId).single(), 'merge: load winner'),
    ]);

    // 1. Remember every spelling that should now resolve to the winner.
    const spellings = new Set((Array.isArray(winner.aliases) ? winner.aliases : []).map(normalizeClub));
    spellings.add(normalizeClub(loser.name));
    for (const a of (Array.isArray(loser.aliases) ? loser.aliases : [])) {
      const n = normalizeClub(a); if (n) spellings.add(n);
    }
    spellings.delete(normalizeClub(winner.name)); // the winner's own name isn't an alias
    ok(await supabase.from(CLUB_TABLE).update({ aliases: [...spellings].filter(Boolean) }).eq('id', winnerId),
      'merge: update aliases');

    // 2. Repoint history from the loser to the winner.
    ok(await supabase.from(RESULT_TABLE).update({ club_id: winnerId }).eq('club_id', loserId),
      'merge: repoint results');
    ok(await supabase.from(SWIMMER_TABLE).update({ current_club_id: winnerId }).eq('current_club_id', loserId),
      'merge: repoint swimmers');

    // 3. Tombstone the loser, and re-point anything previously merged INTO it so
    //    chains collapse straight to the surviving club.
    ok(await supabase.from(CLUB_TABLE).update({ canonical_club_id: winnerId }).eq('id', loserId),
      'merge: tombstone loser');
    ok(await supabase.from(CLUB_TABLE).update({ canonical_club_id: winnerId }).eq('canonical_club_id', loserId),
      'merge: collapse chain');
    return { into: winnerId };
  },

  /** Rename a club's canonical display name (also updates its match key). */
  renameClub: async (clubId, name) => {
    const clean = (name || '').trim();
    if (!clean) throw new Error('Club name cannot be empty.');
    return ok(await supabase.from(CLUB_TABLE)
      .update({ name: clean, normalized_name: normalizeClub(clean) })
      .eq('id', clubId).select().single(),
      'rename club');
  },

  /* ------------------------------------------------------------------ *
   * REVERSE — undo an approved import (delete its results, keep the audit)
   * ------------------------------------------------------------------ */

  reverseBatch: async (batchId) => {
    const del = await supabase.from(RESULT_TABLE).delete().eq('import_batch_id', batchId).select('id');
    const deleted = ok(del, 'reverse: delete results')?.length ?? 0;
    ok(await supabase.from(BATCH_TABLE).update({ status: 'reversed', results_imported: 0 }).eq('id', batchId),
      'reverse: mark batch');
    return { deleted };
  },

  /**
   * Delete a batch entirely — its files, staged rows, and any published results
   * cascade away (FK on delete cascade). Frees the files' SHA-256 so the same
   * PDFs can be re-imported cleanly. Use for a bad/mis-grouped import; use
   * reverseBatch instead to un-publish while keeping the audit trail.
   */
  deleteBatch: async (batchId) => {
    ok(await supabase.from(BATCH_TABLE).delete().eq('id', batchId), 'delete batch');
    return { deleted: batchId };
  },
};

/** Dedup key for a swimmer within an approval run. */
function swimmerKey(row) {
  return `${normalizeName(row.full_name)}|${(row.gender || '').toUpperCase()}`;
}
