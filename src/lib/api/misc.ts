import { supabase } from "../supabase";
import { handleResponse } from "../apiHelpers";
import { AuditAPI } from "./audit";
import type { DbRow } from "./_types";

export interface Feedback {
  id: string;
  eventId: string;
  role: string;
  overallRating: number;
  competitionRating: number;
  venueRating: number;
  communicationRating: number;
  npsScore?: number;
  likedMost?: string;
  improveFuture?: string;
}

export interface FeedbackStats {
  total: number;
  avgOverall: number;
  roles: { Coach: number; Athlete: number };
}

function mapFeedbackToDB(f: Partial<Feedback>): DbRow {
  return { event_id: f.eventId, role: f.role, overall_rating: f.overallRating, competition_rating: f.competitionRating, venue_rating: f.venueRating, communication_rating: f.communicationRating, nps_score: f.npsScore, liked_most: f.likedMost, improve_future: f.improveFuture };
}
function mapFeedbackFromDB(db: DbRow): Feedback {
  return { id: db.id, eventId: db.event_id, role: db.role, overallRating: db.overall_rating, competitionRating: db.competition_rating, venueRating: db.venue_rating, communicationRating: db.communication_rating };
}

export const FeedbackAPI = {
  submit: async (feedback: Partial<Feedback>): Promise<boolean> => {
    const dbFeedback = mapFeedbackToDB(feedback);
    await handleResponse(() => supabase.from("event_feedback").insert([dbFeedback]));
    AuditAPI.log("feedback_submitted", { eventId: feedback.eventId });
    return true;
  },
  getAll: async (eventId?: string): Promise<Feedback[]> => {
    let q = supabase.from("event_feedback").select("*").order("created_at", { ascending: false });
    if (eventId) q = q.eq("event_id", eventId);
    const data = await handleResponse(() => q);
    return (data || []).map(mapFeedbackFromDB);
  },
  getStats: async (eventId?: string): Promise<FeedbackStats | null> => {
    const data = await FeedbackAPI.getAll(eventId);
    if (!data.length) return null;
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    return {
      total: data.length,
      avgOverall: avg(data.map(f => f.overallRating || 0)),
      roles: { Coach: data.filter(f => f.role === "Coach").length, Athlete: data.filter(f => f.role === "Athlete").length }
    };
  }
};

export const MainScannerAPI = {
  getConfig: async (eventId: string): Promise<DbRow | null> => {
    const data = await handleResponse(() => supabase.from("global_settings").select("value").eq("key", `main_scanner_config_${eventId}`).maybeSingle());
    try { return data?.value ? JSON.parse(data.value) : null; } catch { return null; }
  },
  saveConfig: async (eventId: string, config: DbRow): Promise<DbRow> => {
    await handleResponse(() => supabase.from("global_settings").upsert({ key: `main_scanner_config_${eventId}`, value: JSON.stringify(config) }, { onConflict: 'key' }));
    return config;
  }
};

export const ConfigAPI = {
  getFeedback: async (eventId: string): Promise<DbRow | null> => {
    return handleResponse(() => supabase.from("feedback_configs").select("*").eq("event_id", eventId).maybeSingle());
  },
  saveFeedback: async (config: DbRow): Promise<DbRow> => {
    const existing = await handleResponse(() => supabase.from("feedback_configs").select("id").eq("event_id", config.event_id).maybeSingle());
    if (existing) {
      return handleResponse(() => supabase.from("feedback_configs").update({ ...config, updated_at: new Date().toISOString() }).eq("id", existing.id).select().single());
    } else {
      return handleResponse(() => supabase.from("feedback_configs").insert([{ ...config, created_at: new Date().toISOString() }]).select().single());
    }
  }
};

export const BookingsAPI = {
  getConfig: async (eventId: string): Promise<DbRow | null> => {
    return handleResponse(() => supabase.from("booking_configs").select("*").eq("event_id", eventId).maybeSingle());
  },
  saveConfig: async (config: DbRow): Promise<DbRow> => {
    const existing = await handleResponse(() => supabase.from("booking_configs").select("id").eq("event_id", config.event_id).maybeSingle());
    const payload: DbRow = { ...config, updated_at: new Date().toISOString() };
    delete payload.id;
    delete payload.created_at;
    delete payload.hidden_dates;
    if (existing) {
      return handleResponse(() => supabase.from("booking_configs").update(payload).eq("id", existing.id).select().single());
    } else {
      return handleResponse(() => supabase.from("booking_configs").insert([{ ...payload, created_at: new Date().toISOString() }]).select().single());
    }
  },
  getBookings: async (eventId: string): Promise<DbRow[]> => {
    const data = await handleResponse(() => supabase
      .from("bookings")
      .select("*, accreditations (id, accreditation_id, first_name, last_name, club, role, badge_number)")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
    );
    return data || [];
  },
  getParticipantBooking: async (eventId: string, accreditationId: string): Promise<DbRow[]> => {
    const data = await handleResponse(() => supabase.rpc("get_my_booking", { p_event_id: eventId, p_accreditation_id: accreditationId }));
    return data || [];
  },
  bookSlot: async (eventId: string, accreditationId: string, slotId: string, groupName = "General Meeting"): Promise<DbRow> => {
    return handleResponse(() => supabase.rpc("upsert_my_booking", { p_event_id: eventId, p_accreditation_id: accreditationId, p_slot_id: slotId, p_group_name: groupName }));
  },
  cancelBooking: async (eventId: string, accreditationId: string, slotId: string): Promise<DbRow> => {
    return handleResponse(() => supabase.rpc("delete_my_booking", { p_event_id: eventId, p_accreditation_id: accreditationId, p_slot_id: slotId }));
  }
};
