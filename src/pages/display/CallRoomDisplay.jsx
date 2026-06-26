import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CallRoomAPI, screenOffsetFromSlug } from "../../lib/callRoomApi";

// Public, unauthenticated full-screen view for a single call-room screen.
// URL: /display/:eventId/:row   (e.g. /display/<uuid>/row-a)
// Each screen shows heat_list[position + offset], where offset is derived from
// the row slug (row-a = 0, row-b = 1, ...). It subscribes to Realtime so the
// marshal's "Next Heat" updates every screen instantly with no manual reload.
export default function CallRoomDisplay() {
  const { eventId, row } = useParams();
  const offset = screenOffsetFromSlug(row);
  const rowLabel = String(row || "").replace(/^row-/i, "").toUpperCase() || "A";

  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [eventLogo, setEventLogo] = useState(null);
  const [sponsors, setSponsors] = useState([]);

  // The call-room screens are ALWAYS a dark, full-screen display, independent of
  // the admin app's light/dark theme. Force the `dark` class on <html> so the
  // global "light mode contrast safety net" CSS (which remaps bg-slate-*/
  // text-white to light colours for the admin UI) can never invert this page
  // when the device/browser is set to light mode.
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    root.classList.add("dark");
    return () => {
      if (!hadDark) root.classList.remove("dark");
    };
  }, []);

  // Branding (event logo + sponsor logos) loads once per screen; it doesn't
  // change between heats.
  useEffect(() => {
    let active = true;
    CallRoomAPI.getEventBranding(eventId)
      .then((b) => {
        if (!active) return;
        setEventLogo(b?.logo_url || null);
        setSponsors(Array.isArray(b?.sponsor_logos) ? b.sponsor_logos.filter(Boolean) : []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [eventId]);

  useEffect(() => {
    let unsub = () => {};
    let active = true;

    const load = async () => {
      try {
        const s = await CallRoomAPI.getState(eventId);
        if (active) setState(s);
      } catch (e) {
        console.error("[CallRoomDisplay] load failed:", e);
      }
    };

    (async () => {
      await load();
      if (active) setLoading(false);

      // Realtime = instant updates when the project has Realtime enabled.
      unsub = CallRoomAPI.subscribeState(
        eventId,
        (next) => setState(next),
        (status) => active && setConnected(status === "SUBSCRIBED")
      );
    })();

    // Polling fallback: guarantees the screen advances within a couple of
    // seconds even if Realtime is unavailable. Harmless when Realtime works.
    const poll = setInterval(load, 2500);

    return () => {
      active = false;
      clearInterval(poll);
      unsub();
    };
  }, [eventId]);

  const heatList = state?.heat_list || [];
  const index = (state?.position ?? 0) + offset;
  const heat = state?.started ? heatList[index] : undefined;

  return (
    <div className="min-h-screen w-full bg-slate-950 text-white flex flex-col overflow-hidden select-none">
      {/* Top bar: which screen + live status */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-slate-800 bg-slate-900/60">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center">
            <span className="text-3xl font-black text-cyan-300">{rowLabel}</span>
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500">Call Room Screen</p>
            <p className="text-xl font-bold text-slate-200">Row {rowLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${connected ? "bg-emerald-400 animate-pulse" : "bg-amber-400 animate-pulse"}`}
          />
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">
            {connected ? "Live" : "Auto-sync"}
          </span>
        </div>
      </div>

      {/* Main heat card */}
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6">
        {/* Event logo — sits above the heat number, sized so it never rivals it */}
        {eventLogo && (
          <img
            src={eventLogo}
            alt="Event logo"
            className="h-20 sm:h-24 w-auto max-w-[60vw] object-contain"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        )}

        {loading ? (
          <p className="text-2xl font-bold text-slate-600 uppercase tracking-widest animate-pulse">Loading…</p>
        ) : !state?.started ? (
          <Placeholder
            title="Waiting for the call room to start"
            subtitle="The marshal will begin the session shortly."
          />
        ) : !heat ? (
          <Placeholder
            title="No upcoming heat on this screen"
            subtitle="All heats on this row have been called."
          />
        ) : (
          <div className="text-center w-full max-w-5xl mx-auto animate-in fade-in zoom-in-95 duration-500">
            <p className="text-[12px] sm:text-sm font-black uppercase tracking-[0.4em] text-cyan-400 mb-4">
              {offset === 0 ? "Now Calling" : `Upcoming · +${offset}`}
            </p>

            {/* Heat number — the hero element, readable across the room */}
            <div className="mb-8">
              <p className="text-[10vw] leading-none font-black text-white drop-shadow-[0_0_40px_rgba(34,211,238,0.25)]">
                HEAT {heat.heat}
              </p>
            </div>

            {/* Event meta */}
            <div className="inline-flex flex-col gap-4 items-center">
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Badge label="Event" value={`#${heat.eventCode || "—"}`} accent="cyan" />
                <Badge label="Gender" value={heat.gender || "Mixed"} accent="amber" />
              </div>
              <p className="text-2xl sm:text-4xl font-bold text-slate-200 max-w-4xl leading-tight">
                {heat.eventName || "—"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer: sponsor logos (falls back to the event name).
          Light strip behind sponsors so dark/colour logos stay visible. */}
      <div
        className={`px-8 py-5 border-t text-center ${
          sponsors.length > 0 ? "bg-white/95 border-slate-300" : "bg-slate-900/60 border-slate-800"
        }`}
      >
        {sponsors.length > 0 ? (
          <div className="flex items-center justify-center gap-x-10 gap-y-4 flex-wrap">
            {sponsors.map((src, i) => (
              <img
                key={`${src}-${i}`}
                src={src}
                alt="Sponsor"
                className="h-10 sm:h-12 w-auto max-w-[180px] object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ))}
          </div>
        ) : (
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500 truncate">
            {state?.event_name || "Apex Call Room Display"}
          </p>
        )}
      </div>
    </div>
  );
}

function Badge({ label, value, accent }) {
  const map = {
    cyan: "bg-cyan-500/10 border-cyan-500/30 text-cyan-300",
    amber: "bg-amber-500/10 border-amber-500/30 text-amber-300",
  };
  return (
    <div className={`px-5 py-2.5 rounded-xl border ${map[accent]} flex items-center gap-2`}>
      <span className="text-[10px] font-black uppercase tracking-widest opacity-70">{label}</span>
      <span className="text-2xl font-black">{value}</span>
    </div>
  );
}

function Placeholder({ title, subtitle }) {
  return (
    <div className="text-center">
      <p className="text-3xl sm:text-5xl font-black text-slate-300 mb-3">{title}</p>
      <p className="text-lg text-slate-600 font-medium">{subtitle}</p>
    </div>
  );
}
