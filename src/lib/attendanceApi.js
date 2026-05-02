import { supabase } from "./supabase";

export const AttendanceAPI = {
  /**
   * Records a new scan to the database.
   * @param {Object} data 
   * @param {string} data.eventId
   * @param {string} data.athleteId
   * @param {string} data.clubName 
   * @param {string} data.scannerLocation
   * @param {string} data.sessionId
   * @param {boolean} data.zoneOnly
   * @returns {Object} result indicating success, duplicate, or error
   */
  recordScan: async ({ eventId, athleteId, clubName, scannerLocation, date, sessionId, zoneOnly }) => {
    try {
      const now = new Date();
      const checkInDate = date || now.toISOString().split("T")[0];
      const checkInTime = now.toISOString();

      // Check if duplicate exists for this specific session
      let query = supabase
        .from("event_attendance")
        .select("id, scan_count")
        .eq("event_id", eventId)
        .eq("athlete_id", athleteId);
      
      if (sessionId) {
        query = query.eq("session_id", sessionId);
      } else {
        query = query.eq("check_in_date", checkInDate);
      }

      // If zone-specific, only block if they already scanned in THIS specific zone/location
      if (zoneOnly && scannerLocation) {
        query = query.eq("scanner_location", scannerLocation);
      }

      const { data: existing, error: checkError } = await query.maybeSingle();
        
      if (existing) {
        // Increment scan count
        await supabase
          .from("event_attendance")
          .update({ scan_count: (existing.scan_count || 1) + 1 })
          .eq("id", existing.id);
          
        // Requirement 2.2: Even if it's a duplicate, show "success" if it's a different location 
        // or if the user wants "Access Granted" every time.
        return { 
          status: "success", 
          message: "Access Granted (Repeat Entry)"
        };
      }

      // Insert new record
      const { error: insertError } = await supabase
        .from("event_attendance")
        .insert([{
          event_id: eventId,
          athlete_id: athleteId,
          session_id: sessionId || null,
          club_name: clubName || null,
          check_in_date: checkInDate,
          check_in_time: checkInTime,
          scanner_location: scannerLocation || "Main Entrance",
          scan_count: 1
        }]);

      if (insertError) {
        if (insertError.code === "23505") { // Unique violation
          return { status: "success", message: "Access Granted" };
        }
        throw insertError;
      }

      return { status: "success", message: "Access Granted" };

    } catch (err) {
      console.error("[AttendanceAPI] error recording scan:", err);
      return { status: "error", message: err.message || "Failed to record attendance." };
    }
  },

  /**
   * Gets attendance sheet for an event
   */
  getAttendanceForEvent: async (eventId, dateStr) => {
    try {
      const targetDate = dateStr || new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from("event_attendance")
        .select("*")
        .eq("event_id", eventId)
        .eq("check_in_date", targetDate);
        
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("[AttendanceAPI] get error:", err);
      return [];
    }
  },

  /**
   * Gets ALL attendance records for an athlete
   */
  getAthleteAttendance: async (eventId, athleteId) => {
    try {
      const { data, error } = await supabase
        .from("event_attendance")
        .select("*")
        .eq("event_id", eventId)
        .eq("athlete_id", athleteId);
        
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("[AttendanceAPI] getAthleteAttendance error:", err);
      return [];
    }
  },

  /**
   * Gets ALL attendance records for an event regardless of date
   */
  getEventAttendance: async (eventId) => {
    try {
      const { data, error } = await supabase
        .from("event_attendance")
        .select("*")
        .eq("event_id", eventId);
        
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("[AttendanceAPI] getEventAttendance error:", err);
      return [];
    }
  },

  /**
   * SESSIONS MANAGEMENT
   */
  getSessions: async (eventId, date) => {
    const { data, error } = await supabase
      .from("event_sessions")
      .select("*")
      .eq("event_id", eventId)
      .eq("session_date", date)
      .order("start_time", { ascending: true });
    if (error) throw error;
    return data;
  },

  createSession: async ({ eventId, sessionName, eventName, eventNumber, startTime, endTime, date }) => {
    const { data: res, error } = await supabase
      .from("event_sessions")
      .insert([{
        event_id: eventId,
        session_name: sessionName,
        event_name: eventName || null,
        event_number: eventNumber || null,
        start_time: startTime,
        end_time: endTime,
        session_date: date
      }])
      .select()
      .single();
    if (error) throw error;
    return res;
  },

  /**
   * Bulk creates sessions for an entire meet day
   */
  bulkCreateSessions: async (sessions) => {
    if (!sessions || sessions.length === 0) return [];
    
    // Chunk processing for 10,000+ lines scenario
    const CHUNK_SIZE = 500;
    const results = [];
    
    for (let i = 0; i < sessions.length; i += CHUNK_SIZE) {
      const chunk = sessions.slice(i, i + CHUNK_SIZE);
      const rows = chunk.map(s => ({
        event_id: s.eventId,
        session_name: s.sessionName,
        event_name: s.eventName || null,
        event_number: s.eventNumber || null,
        start_time: s.startTime,
        end_time: s.endTime,
        session_date: s.date
      }));
      
      const { data, error } = await supabase
        .from("event_sessions")
        .upsert(rows, { onConflict: 'event_id,event_number,session_date' });
        
      if (error) throw error;
      if (data) results.push(...data);
    }
    return results;
  },

  updateSession: async ({ id, sessionName, eventName, eventNumber, startTime, endTime, date }) => {
    const { data, error } = await supabase
      .from("event_sessions")
      .update({
        session_name: sessionName,
        event_name: eventName || null,
        event_number: eventNumber || null,
        start_time: startTime,
        end_time: endTime,
        session_date: date
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  deleteSession: async (id) => {
    const { error } = await supabase
      .from("event_sessions")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return true;
  },

  unmarkAttendance: async (eventId, athleteId, dateStr) => {
    try {
      const targetDate = dateStr || new Date().toISOString().split('T')[0];
      const { error } = await supabase
        .from("event_attendance")
        .delete()
        .eq("event_id", eventId)
        .eq("athlete_id", athleteId)
        .eq("check_in_date", targetDate);
        
      if (error) throw error;
      return { status: "success", message: "Attendance unmarked successfully." };
    } catch (err) {
      console.error("[AttendanceAPI] unmark error:", err);
      return { status: "error", message: err.message || "Failed to unmark." };
    }
  },

  /**
   * Logs a scan event to the unified_scan_logs table for auditing
   */
  logScanEvent: async ({ eventId, athleteId, spectatorId, scanMode, deviceLabel, sessionId }) => {
    try {
      const { error } = await supabase
        .from("unified_scan_logs")
        .insert([{
          event_id: eventId,
          athlete_id: athleteId || null,
          spectator_id: spectatorId || null,
          session_id: sessionId || null,
          scan_mode: scanMode,
          device_label: deviceLabel || "Unknown"
        }]);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error("[AttendanceAPI] logScanEvent error:", err);
      return false;
    }
  },

  /**
   * Retrieves scan logs for the administrative audit ledger
   */
  getScanLogs: async (limit = 100) => {
    try {
      const { data, error } = await supabase
        .from("unified_scan_logs")
        .select(`
          *,
          accreditations:athlete_id (id, first_name, last_name, club, badge_number, role),
          spectator_orders:spectator_id (id, customer_name, qr_code_id)
        `)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("[AttendanceAPI] getScanLogs error:", err);
      return [];
    }
  },

  /**
   * Retrieves scan logs for a specific event
   */
  getScanLogsByEvent: async (eventId, limit = 500) => {
    try {
      const { data, error } = await supabase
        .from("unified_scan_logs")
        .select(`
          *,
          accreditations:athlete_id (id, first_name, last_name, club, badge_number, role, selected_sports),
          spectator_orders:spectator_id (id, customer_name, qr_code_id)
        `)
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("[AttendanceAPI] get error:", err);
      return [];
    }
  },

  /**
   * Gets ALL attendance records for an event regardless of date
   */
  getEventAttendance: async (eventId) => {
    try {
      const { data, error } = await supabase
        .from("event_attendance")
        .select("*")
        .eq("event_id", eventId);
        
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("[AttendanceAPI] getEventAttendance error:", err);
      return [];
    }
  },

  /**
   * SESSIONS MANAGEMENT
   */
  getSessions: async (eventId, date) => {
    const { data, error } = await supabase
      .from("event_sessions")
      .select("*")
      .eq("event_id", eventId)
      .eq("session_date", date)
      .order("start_time", { ascending: true });
    if (error) throw error;
    return data;
  },

  createSession: async ({ eventId, sessionName, eventName, eventNumber, startTime, endTime, date }) => {
    const { data: res, error } = await supabase
      .from("event_sessions")
      .insert([{
        event_id: eventId,
        session_name: sessionName,
        event_name: eventName || null,
        event_number: eventNumber || null,
        start_time: startTime,
        end_time: endTime,
        session_date: date
      }])
      .select()
      .single();
    if (error) throw error;
    return res;
  },

  /**
   * Bulk creates sessions for an entire meet day
   */
  bulkCreateSessions: async (sessions) => {
    if (!sessions || sessions.length === 0) return [];
    
    // Chunk processing for 10,000+ lines scenario
    const CHUNK_SIZE = 500;
    const results = [];
    
    for (let i = 0; i < sessions.length; i += CHUNK_SIZE) {
      const chunk = sessions.slice(i, i + CHUNK_SIZE);
      const rows = chunk.map(s => ({
        event_id: s.eventId,
        session_name: s.sessionName,
        event_name: s.eventName || null,
        event_number: s.eventNumber || null,
        start_time: s.startTime,
        end_time: s.endTime,
        session_date: s.date
      }));
      
      const { data, error } = await supabase
        .from("event_sessions")
        .upsert(rows, { onConflict: 'event_id,event_number,session_date' });
        
      if (error) throw error;
      if (data) results.push(...data);
    }
    return results;
  },

  updateSession: async ({ id, sessionName, eventName, eventNumber, startTime, endTime, date }) => {
    const { data, error } = await supabase
      .from("event_sessions")
      .update({
        session_name: sessionName,
        event_name: eventName || null,
        event_number: eventNumber || null,
        start_time: startTime,
        end_time: endTime,
        session_date: date
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  deleteSession: async (id) => {
    const { error } = await supabase
      .from("event_sessions")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return true;
  },

  unmarkAttendance: async (eventId, athleteId, dateStr) => {
    try {
      const targetDate = dateStr || new Date().toISOString().split('T')[0];
      const { error } = await supabase
        .from("event_attendance")
        .delete()
        .eq("event_id", eventId)
        .eq("athlete_id", athleteId)
        .eq("check_in_date", targetDate);
        
      if (error) throw error;
      return { status: "success", message: "Attendance unmarked successfully." };
    } catch (err) {
      console.error("[AttendanceAPI] unmark error:", err);
      return { status: "error", message: err.message || "Failed to unmark." };
    }
  },

  /**
   * Logs a scan event to the unified_scan_logs table for auditing
   */
  logScanEvent: async ({ eventId, athleteId, spectatorId, scanMode, deviceLabel, sessionId }) => {
    try {
      const { error } = await supabase
        .from("unified_scan_logs")
        .insert([{
          event_id: eventId,
          athlete_id: athleteId || null,
          spectator_id: spectatorId || null,
          session_id: sessionId || null,
          scan_mode: scanMode,
          device_label: deviceLabel || "Unknown"
        }]);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error("[AttendanceAPI] logScanEvent error:", err);
      return false;
    }
  },

  /**
   * Retrieves scan logs for the administrative audit ledger
   */
  getScanLogs: async (limit = 100) => {
    try {
      const { data, error } = await supabase
        .from("unified_scan_logs")
        .select(`
          *,
          accreditations:athlete_id (id, first_name, last_name, club, badge_number, role),
          spectator_orders:spectator_id (id, customer_name, qr_code_id)
        `)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("[AttendanceAPI] getScanLogs error:", err);
      return [];
    }
  },

  /**
   * Retrieves scan logs for a specific event
   */
  getScanLogsByEvent: async (eventId, limit = 500) => {
    try {
      let q = supabase
        .from("unified_scan_logs")
        .select(`
          *,
          accreditations:athlete_id (id, first_name, last_name, club, badge_number, role, selected_sports),
          spectator_orders:spectator_id (id, customer_name, qr_code_id)
        `)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (eventId && eventId !== "null") {
        q = q.eq("event_id", eventId);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("[AttendanceAPI] getScanLogsByEvent error:", err);
      return [];
    }
  }
};
