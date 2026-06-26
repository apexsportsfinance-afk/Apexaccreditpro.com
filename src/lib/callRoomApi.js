// --- CALL ROOM HEAT DISPLAY API ---
// Drives the call-room display screens. Self-contained: reads heat metadata from
// the existing lane_matrix heat sheet, writes only to its own call_room_state
// table. See supabase/migrations/20260654_call_room_display.sql.
import { supabase } from "./supabase";

// Numeric-aware key: pulls the leading number out of a value like "Session 3",
// "307" or "12" so heats sort 1,2,...,10,11 instead of lexicographically.
const num = (v) => {
  const n = parseInt(String(v ?? "").replace(/\D/g, ""), 10);
  return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
};

// Local copy of the gender parser. Inlined (rather than imported from
// CoachHeatParser) so the public display bundle doesn't pull in the heavy PDF/
// XLSX parser — that is loaded dynamically, marshal-side only, in buildHeatList.
const genderFromEventName = (eventName) => {
  if (!eventName) return "Mixed";
  const lower = String(eventName).toLowerCase();
  if (lower.includes("girl") || lower.includes("women") || lower.includes("female")) return "Female";
  if (lower.includes("boy") || lower.includes("men") || lower.includes("male")) return "Male";
  return "Mixed";
};

// Collapse a flat list of rows into one entry per (session, event, heat),
// ordered by session -> event number -> heat number.
const finalizeHeatList = (entries) => {
  const byKey = new Map();
  for (const e of entries) {
    const heat = e.heat;
    if (heat === null || heat === undefined || String(heat).trim() === "") continue;
    const sessionName = e.sessionName || "";
    const eventCode = e.eventCode !== null && e.eventCode !== undefined ? String(e.eventCode) : "";
    const key = `${sessionName}|${eventCode}|${heat}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        eventCode,
        eventName: e.eventName || "",
        gender: e.gender || genderFromEventName(e.eventName),
        heat: String(heat),
        sessionName,
      });
    }
  }
  return [...byKey.values()].sort(
    (a, b) =>
      num(a.sessionName) - num(b.sessionName) ||
      num(a.eventCode) - num(b.eventCode) ||
      num(a.heat) - num(b.heat)
  );
};

export const CallRoomAPI = {
  // Build the ordered call sequence for an event from the heat sheet.
  // Returns a PII-free array: [{ eventCode, eventName, gender, heat, sessionName }]
  // ordered by session -> event number -> heat number.
  buildHeatList: async (eventId) => {
    const id = String(eventId);

    // 1. PREFERRED: parse the COMPLETE uploaded heat-sheet file. When the sheet
    //    was uploaded, the system parsed every row but only saved the rows that
    //    matched an accredited athlete into athlete_events — so events with no
    //    registered swimmers (and individual unmatched heats) never reach the
    //    database. Re-parsing the original file recovers the full meet schedule.
    //    The heavy PDF/XLSX parser is imported dynamically so it never lands in
    //    the public display bundle. Read-only — we don't touch QR/Hy-Tek logic.
    let fileDetail = "not attempted";
    try {
      const { GlobalSettingsAPI } = await import("./broadcastApi");
      const settings = await GlobalSettingsAPI.getAll();
      const url = settings?.[`event_${id}_heat_sheet_url`];
      if (!url) {
        fileDetail = "no heat-sheet file URL on record for this event";
      } else {
        const resp = await fetch(url);
        if (!resp.ok) {
          fileDetail = `file download failed (HTTP ${resp.status})`;
        } else {
          const blob = await resp.blob();
          const name = url.split("?")[0].split("/").pop() || "heatsheet.pdf";
          const file = new File([blob], name, { type: blob.type || "application/pdf" });
          const { parseCompetitionFile } = await import("./CoachHeatParser");
          const rawRows = await parseCompetitionFile(file, "heat_sheet");
          const list = finalizeHeatList(
            (rawRows || []).map((r) => ({
              eventCode: r.eventCode,
              eventName: r.eventName,
              heat: r.heat,
              sessionName: r.sessionName,
              gender: r.gender,
            }))
          );
          console.log(`[CallRoomAPI] parsed ${rawRows?.length || 0} rows from "${name}" -> ${list.length} heats`);
          if (list.length) return { list, source: "file", detail: name };
          fileDetail = `file "${name}" parsed but produced 0 heats`;
        }
      }
    } catch (e) {
      fileDetail = `file error: ${e?.message || e}`;
      console.warn("[CallRoomAPI] heat-sheet file path failed:", e);
    }

    // 2. FALLBACK: matched athlete_events (+ lane_matrix) when no file is stored.
    //    Supabase caps a request at 1000 rows, so we page through to avoid a
    //    silently truncated list.
    const fetchAllRows = async (makeQuery) => {
      const PAGE = 1000;
      let from = 0;
      let rows = [];
      while (from < 100000) {
        // eslint-disable-next-line no-await-in-loop
        const { data, error } = await makeQuery().range(from, from + PAGE - 1);
        if (error) {
          console.warn("[CallRoomAPI] read error:", error.message);
          break;
        }
        if (!data || data.length === 0) break;
        rows = rows.concat(data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return rows;
    };

    const [aeRows, lmRows] = await Promise.all([
      fetchAllRows(() =>
        supabase
          .from("athlete_events")
          .select("event_code, event_name, gender, heat, session_name")
          .eq("event_id", id)
      ),
      fetchAllRows(() =>
        supabase
          .from("lane_matrix")
          .select("event_code, event_name, heat, session_name")
          .eq("meet_id", id)
      ),
    ]);

    const list = finalizeHeatList([
      // athlete_events first so its explicit gender wins on any duplicate heat.
      ...aeRows.map((r) => ({
        eventCode: r.event_code,
        eventName: r.event_name,
        heat: r.heat,
        sessionName: r.session_name,
        gender: r.gender,
      })),
      ...lmRows.map((r) => ({
        eventCode: r.event_code,
        eventName: r.event_name,
        heat: r.heat,
        sessionName: r.session_name,
      })),
    ]);
    console.log(`[CallRoomAPI] using matched-data fallback (${list.length} heats). File reason: ${fileDetail}`);
    return { list, source: "matched", detail: fileDetail };
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
    const { list, source, detail } = await CallRoomAPI.buildHeatList(eventId);
    const { error } = await supabase.from("call_room_state").upsert(
      {
        event_id: String(eventId),
        event_name: eventName || "",
        heat_list: list,
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
    return { list, source, detail };
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
