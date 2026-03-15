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

  // Get active broadcasts for an athlete
  getForAthlete: async (eventId, athleteId) => {
    try {
      // Get global messages for this event
      const { data: globalData, error: globalError } = await supabase
        .from("broadcasts_v2")
        .select("*")
        .eq("event_id", eventId)
        .eq("type", "global")
        .is("deleted_at", null);
      
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
        .is("deleted_at", null);
      
      if (athleteError) {
        console.error("getForAthlete athlete query error:", athleteError);
      }

      const allData = [...(globalData || []), ...(athleteData || [])];
      

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
  sendGlobal: async (message, eventId, attachmentUrl = null, attachmentName = null) => {
    const insertData = {
      message,
      event_id: eventId,
      type: 'global',
      attachment_url: attachmentUrl || null,
      attachment_name: attachmentName || null,
      created_at: new Date().toISOString()
    };
    
    try {
      const { data, error } = await supabase
        .from("broadcasts_v2")
        .insert(insertData)
        .select()
        .single();
        
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
    
    // Fetch existing so we can merge Heat/Lane with Rank/Time
    const { data: existing } = await supabase
      .from("lane_matrix")
      .select("*")
      .eq("meet_id", eventId);
      
    const existingMap = new Map();
    (existing || []).forEach(r => {
      // Key: eventCode_athleteName
      const key = `${String(r.event_code || "").toLowerCase()}_${(r.athlete_name || "").toLowerCase()}`;
      existingMap.set(key, r);
    });
    
    const rows = matrixRows.map(m => {
      const key = `${String(m.eventCode || "").toLowerCase()}_${(m.athleteName || "").toLowerCase()}`;
      const ex = existingMap.get(key);

      return {
        meet_id: eventId,
        event_code: String(m.eventCode || ""),
        event_name: m.eventName || "Unknown Event",
        athlete_name: m.athleteName || "Unknown",
        club: m.club || null,
        age: m.age || null,
        // Match existing data if not currently being uploaded
        heat: type === 'heat_sheet' ? m.heat : (ex?.heat || null),
        lane: type === 'heat_sheet' ? m.lane : (ex?.lane || null),
        rank: type === 'event_result' ? m.rank : (ex?.rank || null),
        result_time: type === 'event_result' ? m.resultTime : (ex?.result_time || null),
        updated_at: new Date().toISOString()
      };
    });

    // Deduplicate in JS first to avoid PK violations within the same batch
    const finalRows = [];
    const seen = new Set();
    for (const r of rows) {
      const key = `${r.event_code}_${r.athlete_name}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      finalRows.push(r);
    }
    
    if (finalRows.length === 0) return 0;
    
    // CRITICAL: We DO NOT pass the 'id' field. Postgres uses the UNIQUE constraint
    // on meet_id, event_code, athlete_name to handle the match and then
    // generates the UUID automatically for new rows.
    const { data, error } = await supabase
      .from("lane_matrix")
      .upsert(finalRows, { 
        onConflict: 'meet_id,event_code,athlete_name',
        ignoreDuplicates: false 
      })
      .select();

    if (error) {
      console.error("[HeatSheetMatrixAPI] Upsert error:", error);
      throw error;
    }
    return data?.length || 0;
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
  }
};

/**
 * Advanced Matching Events API (Replaces lane_matrix)
 */
export const AthleteEventsAPI = {
  upsertEvents: async (athleteEvents) => {
    if (!athleteEvents || athleteEvents.length === 0) return 0;
    
    // 1. Group by athlete and event to perform atomic cleanup
    const cleanups = athleteEvents.map(m => ({
      accId: m.accreditation_id,
      eventCode: m.event_code,
      round: m.round
    })).filter(c => c.accId);

    // UNIQUE set of cleanup keys to minimize DB calls or complex in-clauses
    const uniqueCleanups = Array.from(new Set(cleanups.map(c => `${c.accId}|${c.eventCode}|${c.round}`)))
      .map(k => {
        const [accId, eventCode, round] = k.split('|');
        return { accId, eventCode, round };
      });

    // Chunk cleanup if too many, but for a single PDF upload it's usually manageable
    for (const c of uniqueCleanups) {
      await supabase
        .from("athlete_events")
        .delete()
        .eq("accreditation_id", c.accId)
        .eq("event_code", c.eventCode)
        .eq("round", c.round);
    }
    
    // 2. Insert the new best-match rows
    // Only insert rows that were actually matched or at least have a valid accreditation_id
    const toInsert = athleteEvents.filter(m => m.accreditation_id);
    if (toInsert.length === 0) return 0;

    const { data, error } = await supabase
      .from("athlete_events")
      .upsert(toInsert, {
        onConflict: 'accreditation_id,event_code,heat,lane',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error("[AthleteEventsAPI] Upsert error:", error);
      throw error;
    }
    return data?.length || 0;
  },

  getForAthlete: async (accreditationId) => {
    if (!accreditationId) return [];
    
    // Front-end query directly matches the SQL provided by user
    const { data, error } = await supabase
      .from("athlete_events")
      .select(`
        accreditation_id,
        event_code,
        event_name,
        heat,
        lane,
        round,
        session_time,
        matched,
        match_confidence
      `)
      .eq("accreditation_id", accreditationId)
      .order("event_code", { ascending: true });
      
    if (error) {
      console.error("[AthleteEventsAPI] Fetch error:", error);
      return [];
    }
    return data || [];
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
