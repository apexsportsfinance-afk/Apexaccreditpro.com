import React from "react";
import { useBranding } from "../../contexts/BrandingContext";

// Fully inline-styled card used for html2canvas PNG capture.
// No Tailwind classes — inline styles only for reliable off-screen rendering.
const C = {
  bg:       "#0f172a",
  surface:  "#1e293b",
  surface2: "#131f30",
  gold:     "#dfc58b",
  goldDim:  "#b68b3a",
  text:     "#f1f5f9",
  muted:    "#94a3b8",
  mutedLt:  "#cbd5e1",
  border:   "#2d3f5e",
  green:    "#10b981",
  amber:    "#f59e0b",
  red:      "#ef4444",
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDate = (d) => {
  const m = (d || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${parseInt(m[3])} ${MONTHS[parseInt(m[2]) - 1]}` : (d || "");
};
const fmtTime = (t) => (t || "").slice(0, 5);

function StatusBadge({ status }) {
  let color = C.muted;
  let bg = "transparent";
  let prefix = "";
  if (status === "Live" || status === "Half Time / Break") { color = C.red; bg = "#7f1d1d55"; prefix = "● "; }
  else if (status === "Finished")  { color = C.green;  bg = "#05301d55"; }
  else if (status === "Upcoming")  { color = "#60a5fa"; }
  else if (status === "Cancelled") { color = "#f87171"; }
  else if (status === "Postponed") { color = C.amber;  }
  return (
    <span style={{
      color,
      backgroundColor: bg,
      fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.07em",
      padding: "2px 7px", borderRadius: 4, whiteSpace: "nowrap",
    }}>
      {prefix}{status}
    </span>
  );
}

// Column grid: # | Phase/Round | Date | Time | Team A | Score | Team B | Status
const COL = "20px 1fr 54px 46px 1fr 62px 1fr 80px";

// Column header text-aligns
const H_ALIGN = ["center","left","center","center","right","center","left","center"];

export default function FixturePNGCard({ sport, leagueName, items, eventsMap = {}, cardsMap = {} }) {
  const branding = useBranding();
  const sportLabel = sport ? `${sport.sport_name}${sport.gender ? ` (${sport.gender})` : ""}` : "";
  const today = new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });

  const fmtEvents = (id) =>
    (eventsMap[id] || [])
      .map(ev => `${ev.event_type}: ${ev.player_name}${ev.team_name ? ` (${ev.team_name})` : ""}${ev.minute ? ` ${ev.minute}'` : ""}`)
      .join("  ·  ");

  const fmtCards = (id) =>
    (cardsMap[id] || [])
      .map(c => `${c.card_type === "Red" ? "🟥" : "🟨"} ${c.player_name}${c.team_name ? ` (${c.team_name})` : ""}${c.minute ? ` ${c.minute}'` : ""}${c.reason ? ` — ${c.reason}` : ""}`)
      .join("  ·  ");

  return (
    <div
      id="fixture-png-export-card"
      style={{ width: 920, backgroundColor: C.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif", overflow: "hidden" }}
    >
      {/* ── Header ─────────────────────────────────────── */}
      <div style={{ background: `linear-gradient(130deg, #1e293b 0%, #0f172a 100%)`, padding: "28px 36px 22px", borderBottom: `2px solid ${C.goldDim}` }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ color: C.goldDim, fontWeight: 800, fontSize: 9.5, letterSpacing: "0.24em", textTransform: "uppercase", marginBottom: 8 }}>
              ✦ &nbsp;Fixture Schedule
            </div>
            <div style={{ color: C.text, fontWeight: 900, fontSize: 26, textTransform: "uppercase", letterSpacing: "0.04em", lineHeight: 1.1 }}>
              {sportLabel}
            </div>
            {leagueName && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 9 }}>
                <span style={{ color: C.gold, fontSize: 14 }}>🏆</span>
                <span style={{ color: C.gold, fontWeight: 700, fontSize: 14, letterSpacing: "0.02em" }}>{leagueName}</span>
              </div>
            )}
          </div>
          {/* Matches badge */}
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ color: C.muted, fontSize: 10.5, marginBottom: 10, letterSpacing: "0.02em" }}>{today}</div>
            <div style={{
              color: C.bg,
              background: `linear-gradient(135deg, ${C.gold} 0%, #c4a46b 100%)`,
              fontWeight: 900, fontSize: 13, letterSpacing: "0.1em",
              padding: "7px 18px", borderRadius: 10,
            }}>
              {items.length} MATCHES
            </div>
          </div>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────── */}
      <div style={{ padding: "0 36px" }}>

        {/* Column headers */}
        <div style={{
          display: "grid", gridTemplateColumns: COL, gap: "0 10px",
          backgroundColor: C.surface, padding: "9px 12px",
          borderBottom: `1.5px solid ${C.gold}`,
        }}>
          {["#", "Phase / Round", "Date", "Time", "Team A", "Score", "Team B", "Status"].map((h, i) => (
            <div key={i} style={{
              color: C.gold, fontWeight: 800, fontSize: 9,
              textTransform: "uppercase", letterSpacing: "0.11em",
              textAlign: H_ALIGN[i],
              overflow: "hidden", whiteSpace: "nowrap",
            }}>
              {h}
            </div>
          ))}
        </div>

        {/* Rows */}
        {items.map((m, i) => {
          const evStr = fmtEvents(m.id);
          const cStr  = fmtCards(m.id);
          const isFinished = m.status === "Finished";
          const isLive     = m.status === "Live" || m.status === "Half Time / Break";
          const scoreColor = isFinished ? C.green : isLive ? C.amber : C.muted;
          const scoreLabel = (isFinished || isLive)
            ? `${m.team_a_score ?? 0} – ${m.team_b_score ?? 0}`
            : "vs";
          const rowBg = i % 2 === 0 ? C.bg : C.surface2;

          return (
            <div key={m.id} style={{ borderBottom: `1px solid ${C.border}` }}>
              <div style={{
                display: "grid", gridTemplateColumns: COL, gap: "0 10px",
                padding: "9px 12px",
                backgroundColor: rowBg,
                alignItems: "center",
              }}>
                {/* # */}
                <div style={{ color: C.muted, fontSize: 10, fontWeight: 700, textAlign: "center" }}>{i + 1}</div>

                {/* Phase / Round */}
                <div style={{ color: C.mutedLt, fontSize: 10.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.match_title || ""}
                </div>

                {/* Date */}
                <div style={{ color: C.text, fontSize: 11, textAlign: "center", whiteSpace: "nowrap" }}>
                  {fmtDate(m.match_date)}
                </div>

                {/* Time */}
                <div style={{ color: C.muted, fontSize: 11, textAlign: "center", whiteSpace: "nowrap" }}>
                  {fmtTime(m.match_time)}
                </div>

                {/* Team A */}
                <div style={{
                  color: C.text, fontSize: 12, fontWeight: 700,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  textAlign: "right",
                }}>
                  {m.team_a_name || "TBA"}
                </div>

                {/* Score */}
                <div style={{
                  color: scoreColor, fontSize: 13, fontWeight: 900,
                  textAlign: "center", whiteSpace: "nowrap",
                  background: isLive ? "#7f1d1d30" : isFinished ? "#05301d30" : "transparent",
                  borderRadius: 6, padding: "2px 4px",
                }}>
                  {scoreLabel}
                </div>

                {/* Team B */}
                <div style={{
                  color: C.text, fontSize: 12, fontWeight: 700,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {m.team_b_name || "TBA"}
                </div>

                {/* Status */}
                <div style={{ textAlign: "center" }}>
                  <StatusBadge status={m.status || "Upcoming"} />
                </div>
              </div>

              {/* Events / Cards sub-row */}
              {(evStr || cStr) && (
                <div style={{
                  backgroundColor: i % 2 === 0 ? "#0b131f" : "#0e1826",
                  padding: "4px 12px 6px 46px",
                  display: "flex", flexWrap: "wrap", gap: "0 20px",
                }}>
                  {evStr && <span style={{ color: "#34d399", fontSize: 9.5 }}>⚽ {evStr}</span>}
                  {cStr  && <span style={{ color: C.amber,   fontSize: 9.5 }}>{cStr}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Footer ─────────────────────────────────────── */}
      <div style={{
        marginTop: 24, borderTop: `1px solid ${C.border}`,
        padding: "13px 36px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        backgroundColor: C.surface,
      }}>
        <div style={{ color: C.muted, fontSize: 9.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.2em" }}>
          {branding.isApex ? "Apex Sports Academy" : branding.name}
        </div>
        <div style={{ color: C.muted, fontSize: 9.5, letterSpacing: "0.04em" }}>{today}</div>
      </div>
    </div>
  );
}
