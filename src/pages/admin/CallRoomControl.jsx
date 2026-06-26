import React, { useEffect, useMemo, useState } from "react";
import {
  Radio,
  Play,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Copy,
  ExternalLink,
  Loader2,
  MonitorPlay,
  RefreshCw,
} from "lucide-react";
import { EventsAPI } from "../../lib/api/events";
import { CallRoomAPI } from "../../lib/callRoomApi";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../components/ui/Toast";

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// Marshal Control Page — drives the call-room display screens.
// Route: /admin/call-room  (admin-only via AdminLayout).
export default function CallRoomControl() {
  const { user } = useAuth();
  const toast = useToast();

  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");
  const [state, setState] = useState(null);
  const [loadingState, setLoadingState] = useState(false);
  const [busy, setBusy] = useState(false);
  const [numScreens, setNumScreens] = useState(4);
  const [editing, setEditing] = useState(false);

  const heatList = state?.heat_list || [];
  const position = state?.position ?? 0;
  const started = !!state?.started;
  const selectedEvent = events.find((e) => e.id === eventId);

  // Load the event list once.
  useEffect(() => {
    (async () => {
      try {
        const list = await EventsAPI.getAllMinimal();
        setEvents(list || []);
      } catch (e) {
        console.error(e);
        toast.show("Error", "Could not load events", "error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load + live-subscribe to the selected event's call-room state so the panel
  // stays in sync even if another marshal is controlling it.
  useEffect(() => {
    if (!eventId) {
      setState(null);
      return;
    }
    let unsub = () => {};
    let active = true;
    setLoadingState(true);
    (async () => {
      try {
        const s = await CallRoomAPI.getState(eventId);
        if (active) setState(s);
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoadingState(false);
      }
      unsub = CallRoomAPI.subscribeState(eventId, (next) => setState(next));
    })();
    return () => {
      active = false;
      unsub();
    };
  }, [eventId]);

  const startEvent = async () => {
    if (!eventId) return;
    setBusy(true);
    try {
      const list = await CallRoomAPI.startEvent(eventId, selectedEvent?.name, user?.email);
      // Refetch immediately so the panel updates without waiting on Realtime.
      const fresh = await CallRoomAPI.getState(eventId);
      setState(fresh);
      if (!list.length) {
        toast.show(
          "No heats found",
          "No matched heats for this event yet. Confirm the heat sheet is uploaded under QR System → Hy-Tek Documents.",
          "warning"
        );
      } else {
        toast.show("Call room started", `${list.length} heats loaded · Screen A on Heat ${list[0].heat}`, "success");
      }
    } catch (e) {
      console.error(e);
      const msg = String(e?.message || e || "");
      if (/call_room_state|relation|does not exist|schema cache|could not find the table/i.test(msg)) {
        toast.show(
          "Setup needed",
          "The call_room_state table is missing. Run the call-room migration SQL in Supabase, then try again.",
          "error"
        );
      } else {
        toast.show("Error", "Could not start the call room", "error");
      }
    } finally {
      setBusy(false);
    }
  };

  const move = async (delta) => {
    if (!started || !heatList.length) return;
    const next = clamp(position + delta, 0, heatList.length - 1);
    if (next === position) return;
    setBusy(true);
    try {
      await CallRoomAPI.setPosition(eventId, next, user?.email);
      setState((s) => (s ? { ...s, position: next } : s));
    } catch (e) {
      console.error(e);
      toast.show("Error", "Could not update the screens", "error");
    } finally {
      setBusy(false);
    }
  };

  const jumpTo = async (index) => {
    setBusy(true);
    try {
      const target = clamp(index, 0, heatList.length - 1);
      await CallRoomAPI.setPosition(eventId, target, user?.email);
      setState((s) => (s ? { ...s, position: target } : s));
      setEditing(false);
    } catch (e) {
      console.error(e);
      toast.show("Error", "Could not set the heat", "error");
    } finally {
      setBusy(false);
    }
  };

  // What each physical screen currently shows (Screen A = position, B = +1, ...).
  const screens = useMemo(
    () =>
      Array.from({ length: numScreens }, (_, i) => ({
        label: String.fromCharCode(65 + i),
        slug: `row-${String.fromCharCode(97 + i)}`,
        heat: started ? heatList[position + i] : undefined,
      })),
    [numScreens, started, heatList, position]
  );

  const displayUrl = (slug) => `${window.location.origin}/display/${eventId}/${slug}`;
  const copyUrl = (slug) => {
    navigator.clipboard?.writeText(displayUrl(slug));
    toast.show("Copied", `${displayUrl(slug)}`, "success");
  };

  // Launch every screen at once. A stable window name per row means repeated
  // clicks reuse the same tab/window instead of spawning duplicates.
  const openAllScreens = () => {
    let blocked = false;
    screens.forEach((s) => {
      const w = window.open(displayUrl(s.slug), `callroom-${s.slug}`);
      if (!w) blocked = true;
    });
    if (blocked) {
      toast.show(
        "Pop-ups blocked",
        "Allow pop-ups for this site, then click “Open All Screens” again.",
        "warning"
      );
    } else {
      toast.show("Opening screens", `Launched ${screens.length} display window(s)`, "success");
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center">
          <Radio className="w-6 h-6 text-primary-500" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-main uppercase tracking-tight">Call Room Control</h1>
          <p className="text-sm text-muted">Drive the heat display screens. One button moves every screen forward.</p>
        </div>
      </div>

      {/* Event + screens config */}
      <div className="bg-base-alt border border-border rounded-2xl p-5 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className="block text-[11px] font-black uppercase tracking-widest text-muted mb-2">Event</label>
          <select
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            className="w-full bg-base border border-border rounded-xl px-4 py-2.5 text-main focus:border-primary-500 outline-none"
          >
            <option value="">Select an event…</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-black uppercase tracking-widest text-muted mb-2">Screens</label>
          <select
            value={numScreens}
            onChange={(e) => setNumScreens(Number(e.target.value))}
            className="w-full bg-base border border-border rounded-xl px-4 py-2.5 text-main focus:border-primary-500 outline-none"
          >
            {[1, 2, 3, 4, 5, 6, 8].map((n) => (
              <option key={n} value={n}>
                {n} screen{n > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!eventId ? (
        <div className="text-center py-16 text-muted">
          <MonitorPlay className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-bold uppercase tracking-widest text-sm">Select an event to begin</p>
        </div>
      ) : loadingState ? (
        <div className="flex items-center justify-center py-16 text-muted">
          <Loader2 className="w-7 h-7 animate-spin" />
        </div>
      ) : (
        <>
          {/* Control buttons */}
          <div className="bg-base-alt border border-border rounded-2xl p-5">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={startEvent}
                disabled={busy}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-black uppercase tracking-wider text-sm transition-all"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : started ? <RefreshCw className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {started ? "Restart / Reload Heats" : "Start Event"}
              </button>

              <button
                onClick={() => move(-1)}
                disabled={busy || !started || position <= 0}
                className="flex items-center gap-2 bg-base hover:bg-border disabled:opacity-40 text-main px-5 py-3 rounded-xl font-black uppercase tracking-wider text-sm border border-border transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous Heat
              </button>

              <button
                onClick={() => move(1)}
                disabled={busy || !started || position >= heatList.length - 1}
                className="flex items-center gap-2 bg-primary-500 hover:bg-primary-600 disabled:opacity-40 text-white px-6 py-3 rounded-xl font-black uppercase tracking-wider text-sm transition-all"
              >
                Next Heat
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setEditing((v) => !v)}
                disabled={busy || !started}
                className="flex items-center gap-2 bg-base hover:bg-border disabled:opacity-40 text-main px-5 py-3 rounded-xl font-black uppercase tracking-wider text-sm border border-border transition-all"
              >
                <Pencil className="w-4 h-4" />
                Manual Edit
              </button>

              {started && (
                <span className="ml-auto text-sm font-bold text-muted">
                  Heat {position + 1} <span className="opacity-50">of {heatList.length}</span>
                </span>
              )}
            </div>

            {/* Manual edit: jump Screen A to any heat in the sequence */}
            {editing && started && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-[11px] font-black uppercase tracking-widest text-muted mb-3">
                  Jump “Screen A” to any heat
                </p>
                <div className="max-h-60 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {heatList.map((h, i) => (
                    <button
                      key={`${h.eventCode}-${h.heat}-${i}`}
                      onClick={() => jumpTo(i)}
                      className={`text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                        i === position
                          ? "bg-primary-500/10 border-primary-500/40 text-primary-500"
                          : "bg-base border-border text-main hover:border-primary-500/40"
                      }`}
                    >
                      <span className="font-black">Heat {h.heat}</span>
                      <span className="text-muted"> · Ev #{h.eventCode} · {h.gender}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Live screen preview */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-black uppercase tracking-widest text-muted">
                Live Screen Preview
              </h2>
              <button
                onClick={openAllScreens}
                className="flex items-center gap-2 bg-base hover:bg-border text-main px-3 py-2 rounded-lg font-black uppercase tracking-wider text-[11px] border border-border transition-all"
                title="Open every display screen in its own window"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open All Screens
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {screens.map((s, i) => (
                <div
                  key={s.slug}
                  className={`rounded-2xl border p-4 ${
                    i === 0 ? "border-cyan-500/40 bg-cyan-500/5" : "border-border bg-base-alt"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black uppercase tracking-widest text-muted">Screen {s.label}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => copyUrl(s.slug)}
                        title="Copy display URL"
                        className="p-1.5 rounded-lg text-muted hover:text-primary-500 hover:bg-base transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <a
                        href={displayUrl(s.slug)}
                        target="_blank"
                        rel="noreferrer"
                        title="Open display"
                        className="p-1.5 rounded-lg text-muted hover:text-primary-500 hover:bg-base transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>

                  {s.heat ? (
                    <div>
                      <p className="text-3xl font-black text-main leading-none mb-2">Heat {s.heat.heat}</p>
                      <p className="text-xs font-bold text-muted">
                        Ev #{s.heat.eventCode} · {s.heat.gender}
                      </p>
                      <p className="text-xs text-muted mt-1 line-clamp-2">{s.heat.eventName}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted italic py-3">{started ? "—" : "Not started"}</p>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted mt-3">
              Open each URL on its screen (same Wi-Fi, any browser). Screens update instantly when you press the buttons above.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
