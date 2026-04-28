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
    
    let processedCount = 0;
    console.log(`DIAC_DEBUG: Turbo Matrix Upsert starting for [${matrixRows.length}] rows...`);

    // Speed up large files by processing in concurrent batches of 20
    const batchSize = 20;
    for (let i = 0; i < matrixRows.length; i += batchSize) {
      const batch = matrixRows.slice(i, i + batchSize);
      await Promise.all(batch.map(async (record) => {
        try {
          const { data: ex } = await supabase
            .from("lane_matrix")
            .select("id, heat, lane, rank, result_time")
            .eq("meet_id", eventId)
            .eq("event_code", String(record.eventCode || ""))
            .eq("athlete_name", record.athleteName || "")
            .maybeSingle();

          if (ex) {
            const { error: upErr } = await supabase
              .from("lane_matrix")
              .update({
                meet_id: String(eventId).trim(),
                event_code: String(record.eventCode || "").trim(),
                heat: type === 'heat_sheet' ? record.heat : (ex.heat || null),
                lane: type === 'heat_sheet' ? record.lane : (ex.lane || null),
                rank: type === 'event_result' ? record.rank : (ex.rank || null),
                result_time: type === 'event_result' ? record.resultTime : (ex.result_time || null),
                updated_at: new Date().toISOString()
              })
              .eq("id", ex.id);
            if (!upErr) processedCount++;
          } else {
            const { error: insErr } = await supabase
              .from("lane_matrix")
              .insert({
                meet_id: String(eventId).trim(),
                event_code: String(record.eventCode || "").trim(),
                event_name: (record.eventName || "Unknown Event").substring(0, 200),
                athlete_name: (record.athleteName || "Unknown").substring(0, 200),
                club: record.club || null,
                age: record.age || null,
                heat: record.heat || null,
                lane: record.lane || null,
                rank: record.rank || null,
                result_time: record.resultTime || null,
                updated_at: new Date().toISOString()
              });
            if (!insErr) processedCount++;
          }
        } catch (err) { console.warn("Batch item error:", err); }
      }));
    }
    return processedCount;
  },

  getForAthlete: async (eventId, athleteFirstName, athleteLastName, athleteClub, athleteBirthDate) => {
    if (!athleteFirstName || !athleteLastName) return [];

    const { data, error } = await supabase
      .from("lane_matrix")
      .select("*")
      .eq("meet_id", eventId);

    if (error) return [];

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
  upsertEvents: async (athleteEvents) => {
    if (!athleteEvents || athleteEvents.length === 0) return 0;
    
    let processedCount = 0;
    console.log(`DIAC_DEBUG: Turbo Upsert starting for [${athleteEvents.length}] rows...`);

    // Process rows sequentially to avoid 409 Conflict race conditions on maybeSingle check
    for (const record of athleteEvents) {
      if (!record.accreditation_id || !record.event_code) continue;
      try {
        const round = record.round || 'Finals';
        const { data: ex } = await supabase
          .from("athlete_events")
          .select("id, heat, lane, rank, result_time")
          .eq("accreditation_id", record.accreditation_id)
          .eq("event_code", record.event_code)
          .eq("round", round)
          .maybeSingle();

        if (ex) {
          const { error: upErr } = await supabase
            .from("athlete_events")
            .update({
              rank: (record.rank !== undefined && record.rank !== null) ? record.rank : ex.rank,
              result_time: record.result_time || ex.result_time,
              heat: (record.heat !== undefined && record.heat !== null) ? record.heat : ex.heat,
              lane: (record.lane !== undefined && record.lane !== null) ? record.lane : ex.lane,
              updated_at: new Date().toISOString()
            })
            .eq("id", ex.id);
          if (!upErr) processedCount++;
        } else {
          const { error: insErr } = await supabase
            .from("athlete_events")
            .insert({ ...record, round });
          if (!insErr) processedCount++;
        }
      } catch (err) { 
        console.warn("Event item upsert error:", err); 
      }
    }
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
