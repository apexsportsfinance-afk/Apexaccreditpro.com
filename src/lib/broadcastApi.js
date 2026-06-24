import { supabase } from "./supabase";

/**
 * API for Form Field Settings
 */
export const FormFieldSettingsAPI = {
  getByEventId: async (eventId) => {
    try {
      const { data, error } = await supabase
        .from("form_field_settings")
        .select("*")
        .eq("event_id", eventId);
      if (error) {
        console.error("FormFieldSettingsAPI.getByEventId error:", error);
        throw error;
      }

      // Convert to a record format for easy lookup
      const settings = {};
      (data || []).forEach(s => {
        settings[s.field_name] = s.is_visible;
      });
      return settings;
    } catch (err) {
      console.error("FormFieldSettingsAPI.getByEventId exception:", err);
      return {};
    }
  },

  save: async (eventId, settings) => {
    const rows = Object.entries(settings).map(([key, value]) => ({
      event_id: eventId,
      field_name: key,
      is_visible: value
    }));

    const { data, error } = await supabase
      .from("form_field_settings")
      .upsert(rows, {
        onConflict: 'event_id,field_name',
        ignoreDuplicates: false
      })
      .select();

    if (error) throw error;
    return data || [];
  }
};

/**
 * API for Event Settings (Banner, URLs, etc)
 */
export const EventSettingsAPI = {
  getAll: async (eventId) => {
    try {
      const { data, error } = await supabase
        .from("events")
        .select("broadcast_message, athlete_qr_broadcast_message, broadcast_targets, message_updated_at")
        .eq("id", eventId)
        .single();
      if (error) {
        console.error("EventSettingsAPI.getAll error:", error);
        return {};
      }
      return data || {};
    } catch (err) {
      console.error("EventSettingsAPI.getAll exception:", err);
      return {};
    }
  },
  setMany: async (eventId, settings) => {
    const { error } = await supabase
      .from("events")
      .update(settings)
      .eq("id", eventId);
    if (error) throw error;
    return true;
  }
};

/**
 * Global Settings API
 */
export const GlobalSettingsAPI = {
  getAll: async () => {
    const { data, error } = await supabase.from("global_settings").select("key, value");
    if (error) return {};
    const settings = {};
    (data || []).forEach(s => settings[s.key] = s.value);
    return settings;
  },
  get: async (key) => {
    const { data, error } = await supabase
      .from("global_settings")
      .select("value")
      .eq("key", key)
      .single();
    if (error) return null;
    return data?.value;
  },
  set: async (key, value) => {
    const { data, error } = await supabase
      .from("global_settings")
      .upsert([{ key, value }], { onConflict: 'key' })
      .select();
    if (error) throw error;
    return data;
  },
  remove: async (key) => {
    const { error } = await supabase
      .from("global_settings")
      .delete()
      .eq("key", key);
    if (error) throw error;
    return true;
  },
  /**
   * Universal Club List Sync Utility
   * Fetches clubs for an event, handling v1 and v2 formats.
   * Returns: [{ short, full, fileRegistered }]
   */
  getClubs: async (eventId) => {
    try {
      if (!eventId) return [];
      const v2 = await GlobalSettingsAPI.get(`event_${eventId}_clubs_v2`);
      if (v2) {
        try {
          const parsed = JSON.parse(v2);
          if (parsed && typeof parsed === 'object') {
            if (Array.isArray(parsed.data)) return parsed.data;
            if (Array.isArray(parsed)) {
              return parsed.map(c => typeof c === 'string' ? { short: c, full: c, fileRegistered: 0 } : c).filter(Boolean);
            }
          }
        } catch (e) { console.warn("V2 clubs parse error", e); }
      }

      const v1 = await GlobalSettingsAPI.get(`event_${eventId}_clubs`);
      if (v1) {
        try {
          const parsed = JSON.parse(v1);
          if (Array.isArray(parsed)) {
            return parsed.map(c => typeof c === 'string' ? { short: c, full: c, fileRegistered: 0 } : c).filter(Boolean);
          }
        } catch (e) { console.warn("V1 clubs parse error", e); }
      }
      return [];
    } catch (err) {
      console.error("GlobalSettingsAPI.getClubs error:", err);
      return [];
    }
  },
  /**
   * Dual-write club list for compatibility.
   */
  setClubs: async (eventId, clubsArray, metadata = null) => {
    // 1. Write to rich v2 format
    const payloadV2 = {
      metadata: metadata || { name: "Manual Update", timestamp: new Date().toISOString() },
      data: clubsArray
    };
    await GlobalSettingsAPI.set(`event_${eventId}_clubs_v2`, JSON.stringify(payloadV2));

    // 2. Write to legacy v1 format (array of strings) for backward compatibility
    const fullNames = clubsArray.map(c => c.full || c.short || (typeof c === 'string' ? c : ""));
    await GlobalSettingsAPI.set(`event_${eventId}_clubs`, JSON.stringify([...new Set(fullNames)].sort()));

    return true;
  },
  setMany: async (settings) => {
    const rows = Object.entries(settings).map(([key, value]) => ({ key, value }));
    const { error } = await supabase
      .from("global_settings")
      .upsert(rows);
    if (error) throw error;
    return true;
  }
};

// Map database row to Broadcast UI object
const mapBroadcastFromDB = (db) => ({
  id: db.id,
  eventId: db.event_id,
  type: db.type,
  message: db.message,
  athleteId: db.athlete_id,
  isGlobal: db.type === "global",
  createdAt: db.created_at,
  targetEvents: db.target_events || [],
  targetHeats: db.target_heats || [],
  targetRoles: db.target_roles || [],
  targetZones: db.target_zones || [],
  attachmentUrl: db.attachment_url || null,
  attachmentName: db.attachment_name || null
});

/**
 * V2 Broadcasts API (Unified Notification System)
 */
export const BroadcastV2API = {
  // Create a new broadcast
  create: async (broadcastData) => {
    const dbRow = {
      event_id: broadcastData.eventId,
      type: broadcastData.type,
      message: broadcastData.message,
      athlete_id: broadcastData.athleteId || null,
      target_events: broadcastData.targetEvents || [],
      target_heats: broadcastData.targetHeats || [],
      target_roles: broadcastData.targetRoles || [],
      target_zones: broadcastData.targetZones || [],
      attachment_url: broadcastData.attachmentUrl || null,
      attachment_name: broadcastData.attachmentName || null
    };

    const { data, error } = await supabase
      .from("broadcasts_v2")
      .insert(dbRow)
      .select()
      .single();
    if (error) throw error;
    return mapBroadcastFromDB(data);
  },

  // Get broadcasts for an event (including global ones)
  getByEvent: async (eventId) => {
    const { data, error } = await supabase
      .from("broadcasts_v2")
      .select("*")
      .or(`event_id.eq.${eventId},type.eq.global`)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(db => ({
      ...mapBroadcastFromDB(db),
      eventName: "Loading..." // Will be joined client-side if needed
    }));
  },

  // Get active broadcasts for an athlete (filtered by role and zone)
  getForAthlete: async (eventId, athleteId, athleteRole = null, athleteZones = []) => {
    try {
      // Get global messages for this event
      const { data: globalData, error: globalError } = await supabase
        .from("broadcasts_v2")
        .select("*")
        .eq("event_id", eventId)
        .eq("type", "global")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (globalError) {
        console.error("getForAthlete global query error:", globalError);
      }

      // Get athlete-specific messages
      const { data: athleteData, error: athleteError } = await supabase
        .from("broadcasts_v2")
        .select("*")
        .eq("event_id", eventId)
        .eq("type", "athlete")
        .eq("athlete_id", athleteId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (athleteError) {
        console.error("getForAthlete athlete query error:", athleteError);
      }

      let allData = [...(globalData || []), ...(athleteData || [])];

      // Filter global messages by role and zone if they have targets
      if (athleteRole || athleteZones.length > 0) {
        allData = allData.filter(db => {
          if (db.type !== 'global') return true; // Private messages always pass

          const targetRoles = db.target_roles || [];
          const targetZones = db.target_zones || [];

          // If no targets, it's for everyone
          if (targetRoles.length === 0 && targetZones.length === 0) return true;

          const roleMatch = targetRoles.length === 0 || targetRoles.includes(athleteRole);
          const zoneMatch = targetZones.length === 0 || targetZones.some(z => athleteZones.includes(z));

          return roleMatch && zoneMatch;
        });
      }

      return allData.map(db => ({
        ...mapBroadcastFromDB(db),
        eventName: db.events?.name || "Global"
      }));
    } catch (err) {
      console.error("getForAthlete exception:", err);
      return [];
    }
  },

  // Soft delete a broadcast
  delete: async (id) => {
    const { error } = await supabase
      .from("broadcasts_v2")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    return true;
  },

  // Update a broadcast message
  update: async (id, message) => {
    const { data, error } = await supabase
      .from("broadcasts_v2")
      .update({ message })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return mapBroadcastFromDB(data);
  },

  // Get all broadcasts (for admin panel history)
  getAll: async () => {
    const { data, error } = await supabase
      .from("broadcasts_v2")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(db => ({
      ...mapBroadcastFromDB(db),
      eventName: "Loading..."
    }));
  },

  // Hard delete (permanent)
  hardDelete: async (id) => {
    const { error } = await supabase
      .from("broadcasts_v2")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return true;
  },

  // Send global broadcast
  sendGlobal: async (message, eventId, attachmentUrl = null, attachmentName = null, targetRoles = [], targetZones = []) => {
    try {
      // If a NEW attachment is being uploaded, proactively wipe all legacy attachments
      if (attachmentUrl) {
        const { data: oldBroadcasts } = await supabase
          .from("broadcasts_v2")
          .select("id, attachment_url")
          .eq("event_id", eventId)
          .eq("type", "global")
          .not("attachment_url", "is", null);

        if (oldBroadcasts && oldBroadcasts.length > 0) {
          // 1. Physically delete old file blobs from the storage bucket
          const pathsToDelete = oldBroadcasts
            .map(b => b.attachment_url)
            .filter(url => url && url.includes('/public/accreditation-files/'))
            .map(url => url.split('/public/accreditation-files/')[1]);

          if (pathsToDelete.length > 0) {
            const { error: storageErr } = await supabase.storage.from("accreditation-files").remove(pathsToDelete);
            if (storageErr) console.error("Failed to delete legacy global storage blobs:", storageErr);
          }

          // 2. Clear the attachment references off the legacy broadcast rows
          const oldIds = oldBroadcasts.map(b => b.id);
          const { error: dbErr } = await supabase
            .from("broadcasts_v2")
            .update({ attachment_url: null, attachment_name: null })
            .in("id", oldIds);

          if (dbErr) console.error("Failed to detach legacy global URLs:", dbErr);
        }
      }

      const insertData = {
        message,
        event_id: eventId,
        type: 'global',
        target_roles: targetRoles || [],
        target_zones: targetZones || [],
        attachment_url: attachmentUrl || null,
        attachment_name: attachmentName || null,
        created_at: new Date().toISOString()
      };

      let { data, error } = await supabase
        .from("broadcasts_v2")
        .insert(insertData)
        .select()
        .single();

      // APX-COMPAT: If target_roles/target_zones columns don't exist yet in the schema,
      // retry the insert without those fields so broadcast still works.
      if (error && (error.message?.includes('target_roles') || error.message?.includes('target_zones'))) {
        console.warn("target_roles/target_zones columns not yet in schema — retrying without them. Run the SQL migration to enable full targeting.");
        const fallbackData = {
          message,
          event_id: eventId,
          type: 'global',
          attachment_url: attachmentUrl || null,
          attachment_name: attachmentName || null,
          created_at: new Date().toISOString()
        };
        const result = await supabase
          .from("broadcasts_v2")
          .insert(fallbackData)
          .select()
          .single();
        data = result.data;
        error = result.error;
      }

      if (error) throw error;
      return data;
    } catch (err) {
      console.error("sendGlobal error:", err);
      throw err;
    }
  },


  // Send targeted athlete broadcast
  sendToAthletes: async (eventId, message, athleteIds, attachmentUrl = null, attachmentName = null) => {
    if (!athleteIds || athleteIds.length === 0) return [];

    const broadcasts = athleteIds.map(athleteId => ({
      event_id: eventId,
      type: 'athlete',
      message,
      athlete_id: athleteId,
      attachment_url: attachmentUrl || null,
      attachment_name: attachmentName || null,
      created_at: new Date().toISOString()
    }));

    try {
      const { data, error } = await supabase
        .from("broadcasts_v2")
        .insert(broadcasts)
        .select();

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("sendToAthletes error:", err);
      throw err;
    }
  }
};

// --- HEAT SHEET & RESULTS MATRIX API ---
export const HeatSheetMatrixAPI = {
  // Upserts rows matching meet_id + athlete_name + event_code
  upsertMatrix: async (eventId, matrixRows, type) => {
    if (!matrixRows || matrixRows.length === 0) return 0;

    console.log(`APEX_DEBUG: Bulk Matrix Upsert starting for [${matrixRows.length}] rows...`);
    const cleanedRows = matrixRows.map(record => ({
      meet_id: String(eventId).trim(),
      event_code: String(record.eventCode || "").trim(),
      event_name: (record.eventName || "Unknown Event").substring(0, 200),
      athlete_name: (record.athleteName || "Unknown").substring(0, 200),
      club: record.club || record.teamName || null,
      age: record.age || null,
      heat: record.heat || null,
      lane: record.lane || null,
      rank: record.rank || null,
      result_time: record.resultTime || record.result_time || null,
      session_name: record.sessionName || null,
      race_time: record.raceTime || null,
      call_room_time: record.callRoomTime || null,
      updated_at: new Date().toISOString()
    }));

    // Use bulk upsert with onConflict to handle duplicates
    // We target meet_id + event_code + athlete_name as the uniqueness constraint
    // Note: If your DB doesn't have a unique constraint on these 3 columns, 
    // it will just insert duplicates. We add a limit to avoid payload size issues.
    const batchSize = 100;
    let totalSaved = 0;

    for (let i = 0; i < cleanedRows.length; i += batchSize) {
      const batch = cleanedRows.slice(i, i + batchSize);
      const { data, error } = await supabase
        .from("lane_matrix")
        .upsert(batch, { onConflict: 'meet_id,event_code,athlete_name', ignoreDuplicates: false })
        .select("id");

      if (error) {
        console.error("APEX_DEBUG: Bulk Upsert Error:", error);
        for (const row of batch) {
          const { error: insErr } = await supabase
            .from("lane_matrix")
            .upsert(row, { onConflict: 'meet_id,event_code,athlete_name', ignoreDuplicates: false });
          if (!insErr) totalSaved++;
          else console.error("APEX_DEBUG: Individual Upsert Error:", insErr, row.athlete_name);
        }
      } else {
        totalSaved += data?.length || batch.length;
      }
    }

    console.log(`APEX_DEBUG: Matrix Upsert Finished. Total Saved: ${totalSaved}`);
    return totalSaved;
  },

  getForAthlete: async (eventId, athleteFirstName, athleteLastName, athleteClub, athleteBirthDate) => {
    if (!athleteFirstName || !athleteLastName) return [];

    // APX-PERF: Use server-side filtering to avoid downloading the entire matrix
    const lToken = athleteLastName.split(' ')[0] || athleteLastName;
    const fToken = athleteFirstName.split(' ')[0] || athleteFirstName;

    const { data, error } = await supabase
      .from("lane_matrix")
      .select("*")
      .eq("meet_id", eventId)
      .or(`athlete_name.ilike.%${lToken}%,athlete_name.ilike.%${fToken}%`);

    if (error) {
      console.error("[HeatSheetMatrixAPI] Fetch error:", error);
      return [];
    }

    // Enhanced Match Filter
    const targetName = `${athleteFirstName} ${athleteLastName}`.toLowerCase().trim();
    const targetTokens = targetName.split(/\s+/).filter(t => t.length >= 2);

    return (data || []).filter(row => {
      const dbName = (row.athlete_name || "").toLowerCase().replace(/,/g, ' ').replace(/\s+/g, ' ').trim();

      // Exact Match
      if (dbName === targetName) return true;

      // Token Match (handles Last, First vs First Last)
      const dbTokens = dbName.split(/\s+/).filter(t => t.length >= 2);
      if (dbTokens.length > 0 && targetTokens.length > 0) {
        const matchAllTokens = targetTokens.every(token => dbName.includes(token));
        const reverseMatch = dbTokens.every(token => targetName.includes(token));
        if (matchAllTokens || reverseMatch) return true;
      }

      return false;
    });
  },

  // Clears all rows in lane_matrix for a specific event
  clearMatrixForMeet: async (eventId) => {
    if (!eventId) return 0;
    const { data, error } = await supabase
      .from("lane_matrix")
      .delete()
      .eq("meet_id", eventId)
      .select("id");
    if (error) {
      console.error("[HeatSheetMatrixAPI] Clear error:", error);
      throw error;
    }
    return data?.length || 0;
  }
};

/**
 * Advanced Matching Events API (Replaces lane_matrix)
 */
export const AthleteEventsAPI = {
  upsertEvents: async (athleteEvents, meetEventId = null) => {
    if (!athleteEvents || athleteEvents.length === 0) return 0;

    // APX-PERF: The previous implementation looped sequentially and ran a
    // SELECT + (UPDATE|INSERT) per row — 2 network round-trips each, serial.
    // For a meet with ~900 athlete-event rows that is ~1,800 round-trips and
    // minutes of wait. This version does ONE bulk-fetch of existing rows, then
    // batched bulk INSERTs for new rows and parallelised UPDATEs for the rest.
    //
    // APX-FIX: It also maps each matched record to the ACTUAL athlete_events
    // columns. The matcher emits athlete_name/team_name/event_number and puts
    // the event CODE into the uuid `event_id` column — none of which the table
    // accepts, so EVERY insert was silently rejected and athlete_events stayed
    // empty (heat/lane never reached the QR profile). Real columns are
    // pdf_name / pdf_team / event_code / heat / lane / round / seed_time /
    // session_name / race_time / call_room_time / rank / result_time / matched,
    // and event_id is the meet's uuid (passed in as meetEventId).
    const toRow = (r) => {
      const heat = parseInt(r.heat, 10);
      const lane = parseInt(r.lane, 10);
      const rank = parseInt(r.rank, 10);
      return {
        accreditation_id: r.accreditation_id,
        event_id: meetEventId || null,
        pdf_name: r.athlete_name || r.athleteName || null,
        pdf_team: r.team_name || r.teamName || null,
        event_code: (r.event_code !== undefined && r.event_code !== null) ? String(r.event_code) : null,
        event_name: r.event_name || null,
        gender: r.gender || null,
        heat: Number.isNaN(heat) ? null : heat,
        lane: Number.isNaN(lane) ? null : lane,
        round: r.round || 'Finals',
        seed_time: r.seed_time || r.seedTime || null,
        session_name: r.session_name || r.sessionName || null,
        race_time: r.race_time || r.raceTime || null,
        call_room_time: r.call_room_time || r.callRoomTime || null,
        rank: Number.isNaN(rank) ? null : rank,
        result_time: r.result_time || r.resultTime || null,
        matched: true
      };
    };

    // 1. Map to real columns, drop invalid, dedupe by (accreditation|event|round)
    const byKey = new Map();
    for (const record of athleteEvents) {
      if (!record.accreditation_id || record.event_code === undefined || record.event_code === null) continue;
      const row = toRow(record);
      byKey.set(`${row.accreditation_id}|${row.event_code}|${row.round}`, row);
    }
    const rows = Array.from(byKey.values());
    if (rows.length === 0) return 0;

    console.log(`DIAC_DEBUG: Bulk Upsert starting for [${rows.length}] de-duplicated rows...`);

    // 2. Bulk-fetch existing rows for all involved accreditations (chunked .in())
    const accIds = [...new Set(rows.map(r => r.accreditation_id))];
    const existingByKey = new Map();
    const IN_CHUNK = 200;
    for (let i = 0; i < accIds.length; i += IN_CHUNK) {
      const chunk = accIds.slice(i, i + IN_CHUNK);
      const { data: exRows, error } = await supabase
        .from("athlete_events")
        .select("id, accreditation_id, event_code, round")
        .in("accreditation_id", chunk);
      if (error) { console.warn("[AthleteEvents] existing-row fetch warning:", error.message); continue; }
      (exRows || []).forEach(ex => {
        existingByKey.set(`${ex.accreditation_id}|${ex.event_code}|${ex.round || 'Finals'}`, ex);
      });
    }

    // 3. Partition into fresh inserts vs updates of existing rows
    const toInsert = [];
    const toUpdate = [];
    for (const row of rows) {
      const ex = existingByKey.get(`${row.accreditation_id}|${row.event_code}|${row.round}`);
      if (ex) toUpdate.push({ id: ex.id, row });
      else toInsert.push(row);
    }

    let processedCount = 0;

    // 4. Bulk INSERT new rows in batches (the common case after a meet wipe)
    const BATCH = 200;
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const batch = toInsert.slice(i, i + BATCH);
      const { data, error } = await supabase
        .from("athlete_events")
        .insert(batch)
        .select("id");
      if (error) {
        console.error("[AthleteEvents] Bulk insert failed, retrying row-by-row:", error.message);
        for (const r of batch) {
          const { error: insErr } = await supabase.from("athlete_events").insert(r);
          if (!insErr) processedCount++;
          else console.warn("[AthleteEvents] row insert error:", insErr.message);
        }
      } else {
        processedCount += data?.length || batch.length;
      }
    }

    // 5. UPDATE existing rows in parallel batches (rare; only on re-upload w/o wipe)
    const UPD_CONCURRENCY = 25;
    for (let i = 0; i < toUpdate.length; i += UPD_CONCURRENCY) {
      const slice = toUpdate.slice(i, i + UPD_CONCURRENCY);
      const results = await Promise.all(slice.map(({ id, row }) =>
        supabase
          .from("athlete_events")
          .update({
            // `row` is already mapped to real columns by toRow()
            pdf_name: row.pdf_name,
            pdf_team: row.pdf_team,
            event_name: row.event_name,
            gender: row.gender,
            heat: row.heat,
            lane: row.lane,
            seed_time: row.seed_time,
            session_name: row.session_name,
            race_time: row.race_time,
            call_room_time: row.call_room_time,
            rank: row.rank,
            result_time: row.result_time,
            matched: true,
            updated_at: new Date().toISOString()
          })
          .eq("id", id)
          .then(({ error }) => !error)
      ));
      processedCount += results.filter(Boolean).length;
    }

    console.log(`DIAC_DEBUG: Bulk Upsert finished. Inserted/updated: ${processedCount} (${toInsert.length} new, ${toUpdate.length} existing).`);
    return processedCount;
  },

  getForAthlete: async (accreditationId) => {
    if (!accreditationId) return [];

    const { data, error } = await supabase
      .from("athlete_events")
      .select(`*`)
      .eq("accreditation_id", accreditationId)
      .order("event_code", { ascending: true });

    if (error) {
      console.error("[AthleteEventsAPI] Fetch error:", error);
      return [];
    }
    return data || [];
  },

  clearEventsForMeet: async (eventId) => {
    if (!eventId) return 0;

    // 1. Get ALL accreditations for this event (Paginated to handle >1000 athletes)
    let accIds = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: pageData, error: accErr } = await supabase
        .from("accreditations")
        .select("id")
        .eq("event_id", eventId)
        .range(from, from + pageSize - 1);

      if (accErr) {
        console.error("[AthleteEventsAPI] Fetch accreditation IDs error:", accErr);
        throw accErr;
      }

      if (pageData && pageData.length > 0) {
        accIds = [...accIds, ...pageData.map(a => a.id)];
        if (pageData.length < pageSize) hasMore = false;
        else from += pageSize;
      } else {
        hasMore = false;
      }
    }

    if (accIds.length === 0) return 0;
    let deletedCount = 0;

    // 2. Delete athlete_events in chunks to avoid URL length limits on PostgREST
    const CHUNK_SIZE = 200;
    for (let i = 0; i < accIds.length; i += CHUNK_SIZE) {
      const chunk = accIds.slice(i, i + CHUNK_SIZE);
      const { data, error } = await supabase
        .from("athlete_events")
        .delete()
        .in("accreditation_id", chunk)
        .select("accreditation_id");

      if (!error && data) {
        deletedCount += data.length;
      }
    }

    return deletedCount;
  }
};

/**
 * Sport Events API
 */
export const SportEventsAPI = {
  getByEventId: async (eventId) => {
    const { data, error } = await supabase
      .from("sport_events")
      .select("*")
      .eq("event_id", eventId)
      .order("event_code", { ascending: true });
    if (error) throw error;
    return (data || []).map(event => ({
      id: event.id,
      eventCode: event.event_code,
      eventName: event.event_name,
      gender: event.gender,
      ageGroup: event.age_group,
      session: event.session,
      date: event.date,
      startTime: event.start_time,
      venue: event.venue,
      eventId: event.event_id,
      createdAt: event.created_at,
      updatedAt: event.updated_at
    }));
  },

  create: async (sportEventData) => {
    const dbRow = {
      event_id: sportEventData.eventId,
      event_code: sportEventData.eventCode,
      event_name: sportEventData.eventName,
      gender: sportEventData.gender,
      age_group: sportEventData.ageGroup,
      session: sportEventData.session,
      date: sportEventData.date,
      start_time: sportEventData.startTime,
      venue: sportEventData.venue
    };

    const { data, error } = await supabase
      .from("sport_events")
      .insert(dbRow)
      .select()
      .single();
    if (error) throw error;
    return {
      id: data.id,
      eventCode: data.event_code,
      eventName: data.event_name,
      gender: data.gender,
      ageGroup: data.age_group,
      session: data.session,
      date: data.date,
      startTime: data.start_time,
      venue: data.venue,
      eventId: data.event_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  },

  update: async (id, sportEventData) => {
    const dbRow = {
      event_code: sportEventData.eventCode,
      event_name: sportEventData.eventName,
      gender: sportEventData.gender,
      age_group: sportEventData.ageGroup,
      session: sportEventData.session,
      date: sportEventData.date,
      start_time: sportEventData.startTime,
      venue: sportEventData.venue,
      updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
      .from("sport_events")
      .update(dbRow)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return {
      id: data.id,
      eventCode: data.event_code,
      eventName: data.event_name,
      gender: data.gender,
      ageGroup: data.age_group,
      session: data.session,
      date: data.date,
      startTime: data.start_time,
      venue: data.venue,
      eventId: data.event_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  },

  delete: async (id) => {
    const { error } = await supabase
      .from("sport_events")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return true;
  },

  bulkUpsert: async (eventId, events) => {
    if (!events || events.length === 0) return 0;

    const rows = events.map(event => ({
      event_id: eventId,
      event_code: event.eventCode,
      event_name: event.eventName,
      gender: event.gender,
      age_group: event.ageGroup,
      session: event.session,
      date: event.date,
      start_time: event.startTime,
      venue: event.venue
    }));

    const { data, error } = await supabase
      .from("sport_events")
      .upsert(rows, {
        onConflict: 'event_id,event_code',
        ignoreDuplicates: false
      })
      .select();

    if (error) throw error;
    return data?.length || 0;
  }
};

/**
 * Meet Programmes API
 */
export const MeetProgrammesAPI = {
  getByEventId: async (eventId, limit = 10) => {
    const { data, error } = await supabase
      .from("meet_programmes")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []).map(programme => ({
      id: programme.id,
      eventId: programme.event_id,
      name: programme.name,
      url: programme.url,
      status: programme.status,
      createdAt: programme.created_at,
      updatedAt: programme.updated_at
    }));
  },

  create: async (programmeData) => {
    const dbRow = {
      event_id: programmeData.eventId,
      name: programmeData.name,
      url: programmeData.url,
      status: programmeData.status || 'pending'
    };

    const { data, error } = await supabase
      .from("meet_programmes")
      .insert(dbRow)
      .select()
      .single();
    if (error) throw error;
    return {
      id: data.id,
      eventId: data.event_id,
      name: data.name,
      url: data.url,
      status: data.status,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }
};
