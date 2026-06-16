import { supabase } from "../supabase";
import { handleResponse } from "../apiHelpers";
import { AuditAPI } from "./audit";

function mapFeedbackToDB(f) {
  return { event_id: f.eventId, role: f.role, overall_rating: f.overallRating, competition_rating: f.competitionRating, venue_rating: f.venueRating, communication_rating: f.communicationRating, nps_score: f.npsScore, liked_most: f.likedMost, improve_future: f.improveFuture };
}
function mapFeedbackFromDB(db) {
  return { id: db.id, eventId: db.event_id, role: db.role, overallRating: db.overall_rating, competitionRating: db.competition_rating, venueRating: db.venue_rating, communicationRating: db.communication_rating };
}

export const FeedbackAPI = {
  submit: async (feedback) => {
    const dbFeedback = mapFeedbackToDB(feedback);
    await handleResponse(() => supabase.from("event_feedback").insert([dbFeedback]));
    AuditAPI.log("feedback_submitted", { eventId: feedback.eventId });
    return true;
  },
  getAll: async (eventId) => {
    let q = supabase.from("event_feedback").select("*").order("created_at", { ascending: false });
    if (eventId) q = q.eq("event_id", eventId);
    const data = await handleResponse(() => q);
    return (data || []).map(mapFeedbackFromDB);
  },
  getStats: async (eventId) => {
    const data = await FeedbackAPI.getAll(eventId);
    if (!data.length) return null;
    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    return {
      total: data.length,
      avgOverall: avg(data.map(f => f.overallRating || 0)),
      roles: { Coach: data.filter(f => f.role === "Coach").length, Athlete: data.filter(f => f.role === "Athlete").length }
    };
  }
};

export const MainScannerAPI = {
  getConfig: async (eventId) => {
    const data = await handleResponse(() => supabase.from("global_settings").select("value").eq("key", `main_scanner_config_${eventId}`).maybeSingle());
    try { return data?.value ? JSON.parse(data.value) : null; } catch { return null; }
  },
  saveConfig: async (eventId, config) => {
    await handleResponse(() => supabase.from("global_settings").upsert({ key: `main_scanner_config_${eventId}`, value: JSON.stringify(config) }, { onConflict: 'key' }));
    return config;
  }
};

export const ConfigAPI = {
  getFeedback: async (eventId) => {
    return handleResponse(() => supabase.from("feedback_configs").select("*").eq("event_id", eventId).maybeSingle());
  },
  saveFeedback: async (config) => {
    const existing = await handleResponse(() => supabase.from("feedback_configs").select("id").eq("event_id", config.event_id).maybeSingle());
    if (existing) {
      return handleResponse(() => supabase.from("feedback_configs").update({ ...config, updated_at: new Date().toISOString() }).eq("id", existing.id).select().single());
    } else {
      return handleResponse(() => supabase.from("feedback_configs").insert([{ ...config, created_at: new Date().toISOString() }]).select().single());
    }
  }
};

export const BookingsAPI = {
  getConfig: async (eventId) => {
    return handleResponse(() => supabase.from("booking_configs").select("*").eq("event_id", eventId).maybeSingle());
  },
  saveConfig: async (config) => {
    const existing = await handleResponse(() => supabase.from("booking_configs").select("id").eq("event_id", config.event_id).maybeSingle());
    const payload = { ...config, updated_at: new Date().toISOString() };
    delete payload.id;
    delete payload.created_at;
    delete payload.hidden_dates;
    if (existing) {
      return handleResponse(() => supabase.from("booking_configs").update(payload).eq("id", existing.id).select().single());
    } else {
      return handleResponse(() => supabase.from("booking_configs").insert([{ ...payload, created_at: new Date().toISOString() }]).select().single());
    }
  },
  getBookings: async (eventId) => {
    const data = await handleResponse(() => supabase
      .from("bookings")
      .select("*, accreditations (id, accreditation_id, first_name, last_name, club, role, badge_number)")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
    );
    return data || [];
  },
  getParticipantBooking: async (eventId, accreditationId) => {
    const data = await handleResponse(() => supabase.rpc("get_my_booking", { p_event_id: eventId, p_accreditation_id: accreditationId }));
    return data || [];
  },
  bookSlot: async (eventId, accreditationId, slotId, groupName = "General Meeting") => {
    return handleResponse(() => supabase.rpc("upsert_my_booking", { p_event_id: eventId, p_accreditation_id: accreditationId, p_slot_id: slotId, p_group_name: groupName }));
  },
  cancelBooking: async (eventId, accreditationId, slotId) => {
    return handleResponse(() => supabase.rpc("delete_my_booking", { p_event_id: eventId, p_accreditation_id: accreditationId, p_slot_id: slotId }));
  }
};
