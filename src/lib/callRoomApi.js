// --- CALL ROOM HEAT DISPLAY API ---
// Drives the call-room display screens. Self-contained: reads heat metadata from
// the existing lane_matrix heat sheet, writes only to its own call_room_state
// table. See supabase/migrations/20260654_call_room_display.sql.
import { supabase } from "./supabase";
import { parseGenderFromEvent } from "./CoachHeatParser";

// Numeric-aware key: pulls the leading number out of a value like "Session 3",
// "307" or "12" so heats sort 1,2,...,10,11 instead of lexicographically.
const num = (v) => {
  const n = parseInt(String(v ?? "").replace(/\D/g, ""), 10);
  return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
};

export const CallRoomAPI = {
  // Build the ordered call sequence for an event from the heat sheet.
  // Returns a PII-free array: [{ eventCode, eventName, gender, heat, sessionName }]
  // ordered by session -> event number -> heat number.
  buildHeatList: async (eventId) => {
    const id = String(eventId);

    // Read from the SAME data the Hy-Tek upload produces — no new upload step.
    // Primary: athlete_events (the matched table that powers every swimmer's QR
    //   schedule; it is the canonical, reliably-populated source and even carries
    //   an explicit `gender` column).
    // Supplement: lane_matrix (all raw parsed rows) fills any heats that exist in
    //   the sheet but had no matched athlete. We never WRITE either table here —
    //   the Call Room only reads, so QR System / Hy-Tek logic is untouched.
    const [aeRes, lmRes] = await Promise.all([
      supabase
        .from("athlete_events")
        .select("event_code, event_name, gender, heat, session_name")
        .eq("event_id", id),
      supabase
        .from("lane_matrix")
        .select("event_code, event_name, heat, session_name")
        .eq("meet_id", id),
    ]);

    if (aeRes.error) console.warn("[CallRoomAPI] athlete_events read:", aeRes.error.message);
    if (lmRes.error) console.warn("[CallRoomAPI] lane_matrix read:", lmRes.error.message);

    // Collapse the per-athlete rows down to one entry per (session, event, heat).
    const byKey = new Map();
    const add = (row, genderFromColumn) => {
      const heat = row.heat;
      if (heat === null || heat === undefined || String(heat).trim() === "") return;
      const sessionName = row.session_name || "";
      const eventCode = row.event_code !== null && row.event_code !== undefined ? String(row.event_code) : "";
      const key = `${sessionName}|${eventCode}|${heat}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          eventCode,
          eventName: row.event_name || "",
          gender: genderFromColumn || parseGenderFromEvent(row.event_name),
          heat: String(heat),
          sessionName,
        });
      }
    };

    // athlete_events first so its explicit gender wins on any duplicate heat.
    for (const row of aeRes.data || []) add(row, row.gender);
    for (const row of lmRes.data || []) add(row, null);

    return [...byKey.values()].sort(
      (a, b) =>
        num(a.sessionName) - num(b.sessionName) ||
        num(a.eventCode) - num(b.eventCode) ||
        num(a.heat) - num(b.heat)
    );
  },

  // Read the current control state for an event (null if never started).
  getState: async (eventId) => {
    const { data, error } = await supabase
      .from("call_room_state")
      .select("*")
      .eq("event_id", String(eventId))
      .maybeSingle();

    if (error) {
      console.error("[CallRoomAPI] getState error:", error);
      throw error;
    }
    return data;
  },

  // Start (or restart) the call room: rebuild the heat snapshot, reset to heat 0.
  startEvent: async (eventId, eventName, updatedBy = null) => {
    const heatList = await CallRoomAPI.buildHeatList(eventId);
    const { error } = await supabase.from("call_room_state").upsert(
      {
        event_id: String(eventId),
        event_name: eventName || "",
        heat_list: heatList,
        position: 0,
        started: true,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy,
      },
      { onConflict: "event_id" }
    );

    if (error) {
      console.error("[CallRoomAPI] startEvent error:", error);
      throw error;
    }
    return heatList;
  },

  // Move the leading screen (Screen A) to an absolute heat index. Callers clamp
  // to the valid range; this just persists and broadcasts via Realtime.
  setPosition: async (eventId, position, updatedBy = null) => {
    const { error } = await supabase
      .from("call_room_state")
      .update({
        position,
        started: true,
        updated_at: new Date().toISOString(),
        updated_by: updatedBy,
      })
      .eq("event_id", String(eventId));

    if (error) {
      console.error("[CallRoomAPI] setPosition error:", error);
      throw error;
    }
  },

  // Subscribe to live state changes for one event. cb receives the new row.
  // onStatus (optional) receives the channel status ("SUBSCRIBED",
  // "CHANNEL_ERROR", "TIMED_OUT", "CLOSED") so the UI can show real connectivity.
  // Returns an unsubscribe function.
  subscribeState: (eventId, cb, onStatus) => {
    const channel = supabase
      .channel(`callroom-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "call_room_state",
          filter: `event_id=eq.${String(eventId)}`,
        },
        (payload) => cb(payload.new)
      )
      .subscribe((status) => {
        if (onStatus) onStatus(status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  },
};

// Map a screen slug like "row-a" / "row-c" / "a" to a 0-based offset from the
// leading screen. Screen A = current heat (offset 0), B = next (1), and so on.
export function screenOffsetFromSlug(slug) {
  if (!slug) return 0;
  const letter = String(slug).trim().toLowerCase().replace(/^row-/, "").charAt(0);
  const offset = letter.charCodeAt(0) - "a".charCodeAt(0);
  return offset >= 0 && offset < 26 ? offset : 0;
}
