import { supabase } from "./supabase";

// --- GLOBAL SETTINGS API ---
export const GlobalSettingsAPI = {
  get: async (key) => {
    const { data, error } = await supabase
      .from("global_settings")
      .select("value, updated_at")
      .eq("key", key)
      .single();
    if (error) return null;
    return data;
  },
  getAll: async () => {
    const { data, error } = await supabase.from("global_settings").select("*");
    if (error) return {};
    const map = {};
    (data || []).forEach(row => { map[row.key] = row.value; });
    return map;
  },
  set: async (key, value) => {
    const { error } = await supabase
      .from("global_settings")
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw error;
    return true;
  },
  setMany: async (updates) => {
    const rows = Object.entries(updates).map(([key, value]) => ({
      key,
      value: typeof value === "string" ? value : JSON.stringify(value),
      updated_at: new Date().toISOString()
    }));
    const { error } = await supabase
      .from("global_settings")
      .upsert(rows, { onConflict: "key" });
    if (error) throw error;
    return true;
  }
};

// --- SPORT EVENTS API (meet programme entries) ---
export const SportEventsAPI = {
  getByEventId: async (eventId) => {
    const { data, error } = await supabase
      .from("sport_events")
      .select("*")
      .eq("event_id", eventId)
      .order("event_date", { ascending: true })
      .order("start_time", { ascending: true });
    if (error) throw error;
    return (data || []).map(mapSportEventFromDB);
  },

  bulkUpsert: async (eventId, events) => {
    if (!events || events.length === 0) return;
    const rows = events.map(e => ({
      event_id: eventId,
      event_code: e.eventCode,
      event_name: e.eventName,
      gender: e.gender || null,
      age_min: e.ageMin ? parseInt(e.ageMin) : null,
      age_max: e.ageMax ? parseInt(e.ageMax) : null,
      session: e.session || null,
      event_date: e.date || null,
      start_time: e.startTime || null,
      venue: e.venue || null,
      updated_at: new Date().toISOString()
    }));
    const { error } = await supabase
      .from("sport_events")
      .upsert(rows, { onConflict: "event_id,event_code" });
    if (error) throw error;
    return true;
  },

  deleteByEventId: async (eventId) => {
    const { error } = await supabase
      .from("sport_events")
      .delete()
      .eq("event_id", eventId);
    if (error) throw error;
  },

  getEligibleForAthlete: async (eventId, dateOfBirth, meetFirstDay) => {
    const { data, error } = await supabase
      .from("sport_events")
      .select("*")
      .eq("event_id", eventId)
      .order("event_date", { ascending: true });
    if (error) throw error;
    const all = (data || []).map(mapSportEventFromDB);
    if (!dateOfBirth || !meetFirstDay) return all;
    const dob = new Date(dateOfBirth);
    const firstDay = new Date(meetFirstDay);
    const ageAtMeet = Math.floor((firstDay - dob) / (365.25 * 24 * 60 * 60 * 1000));
    return all.filter(ev => {
      const minOk = ev.ageMin === null || ageAtMeet >= ev.ageMin;
      const maxOk = ev.ageMax === null || ageAtMeet <= ev.ageMax;
      return minOk && maxOk;
    });
  }
};

// --- MEET PROGRAMMES API ---
export const MeetProgrammesAPI = {
  getByEventId: async (eventId, limit = 5) => {
    const { data, error } = await supabase
      .from("meet_programmes")
      .select("*")
      .eq("event_id", eventId)
      .order("version", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data || [];
  },

  create: async (eventId, pdfUrl, parsedEvents) => {
    const { data: latest } = await supabase
      .from("meet_programmes")
      .select("version")
      .eq("event_id", eventId)
      .order("version", { ascending: false })
      .limit(1)
      .single();
    const newVersion = (latest?.version || 0) + 1;
    const { data, error } = await supabase
      .from("meet_programmes")
      .insert([{
        event_id: eventId,
        pdf_url: pdfUrl,
        version: newVersion,
        status: "pending",
        parsed_events: parsedEvents
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  commit: async (programmeId, eventId, events) => {
    await SportEventsAPI.bulkUpsert(eventId, events);
    const { error } = await supabase
      .from("meet_programmes")
      .update({ status: "committed", committed_at: new Date().toISOString() })
      .eq("id", programmeId);
    if (error) throw error;
    await supabase
      .from("meet_programmes")
      .update({ status: "superseded" })
      .eq("event_id", eventId)
      .neq("id", programmeId)
      .eq("status", "committed");
    return true;
  }
};

// --- FORM FIELD SETTINGS API ---
export const FormFieldSettingsAPI = {
  getByEventId: async (eventId) => {
    const { data, error } = await supabase
      .from("form_field_settings")
      .select("*")
      .eq("event_id", eventId);
    if (error) return {};
    const map = {};
    (data || []).forEach(row => { map[row.field_key] = row.display_location; });
    return map;
  },

  save: async (eventId, settings) => {
    const rows = Object.entries(settings).map(([field_key, display_location], i) => ({
      event_id: eventId,
      field_key,
      display_location,
      display_order: i,
      updated_at: new Date().toISOString()
    }));
    if (rows.length === 0) return;
    const { error } = await supabase
      .from("form_field_settings")
      .upsert(rows, { onConflict: "event_id,field_key" });
    if (error) throw error;
    return true;
  }
};

// --- MAPPERS ---
function mapSportEventFromDB(db) {
  return {
    id: db.id,
    eventId: db.event_id,
    eventCode: db.event_code,
    eventName: db.event_name,
    gender: db.gender,
    ageMin: db.age_min,
    ageMax: db.age_max,
    session: db.session,
    date: db.event_date,
    startTime: db.start_time,
    venue: db.venue,
    createdAt: db.created_at
  };
}
