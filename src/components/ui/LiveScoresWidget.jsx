/**
 * LiveScoresWidget.jsx
 * Standalone Live Scores widget for the Apex Accreditation Dashboard.
 * This component is fully self-contained — it has NO dependencies on
 * any other Apex system (no Supabase, no AuthContext, no existing APIs).
 * Safe to add or remove without affecting any other functionality.
 */
import React, { useState, useEffect } from "react";

// ── Static mock fixtures (simulates a live feed) ──────────────────────────────
const INITIAL_FIXTURES = [
  {
    id: 1, homeTeam: "Real Madrid", awayTeam: "FC Barcelona",
    homeScore: 2, awayScore: 1, status: "LIVE", minute: 67,
    league: "La Liga", homeBadge: "🇪🇸", awayBadge: "🇪🇸"
  },
  {
    id: 2, homeTeam: "Man City", awayTeam: "Arsenal",
    homeScore: 0, awayScore: 0, status: "LIVE", minute: 34,
    league: "Premier League", homeBadge: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", awayBadge: "🏴󠁧󠁢󠁥󠁮󠁧󠁿"
  },
  {
    id: 3, homeTeam: "PSG", awayTeam: "Lyon",
    homeScore: null, awayScore: null, status: "UPCOMING", minute: null,
    league: "Ligue 1", homeBadge: "🇫🇷", awayBadge: "🇫🇷", kickoff: "21:00"
  },
  {
    id: 4, homeTeam: "Bayern Munich", awayTeam: "Dortmund",
    homeScore: 3, awayScore: 2, status: "FT", minute: 90,
    league: "Bundesliga", homeBadge: "🇩🇪", awayBadge: "🇩🇪"
  },
  {
    id: 5, homeTeam: "Juventus", awayTeam: "Inter Milan",
    homeScore: 1, awayScore: 1, status: "LIVE", minute: 78,
    league: "Serie A", homeBadge: "🇮🇹", awayBadge: "🇮🇹"
  },
];

const STATUS_STYLES = {
  LIVE:     { dot: "#10b981", badge: "rgba(16,185,129,0.15)", text: "#10b981", border: "rgba(16,185,129,0.3)" },
  FT:       { dot: "#64748b", badge: "rgba(100,116,139,0.1)", text: "#94a3b8", border: "rgba(100,116,139,0.2)" },
  UPCOMING: { dot: "#6366f1", badge: "rgba(99,102,241,0.1)",  text: "#818cf8", border: "rgba(99,102,241,0.2)" },
};

export default function LiveScoresWidget() {
  const [fixtures, setFixtures] = useState(INITIAL_FIXTURES);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [pulse, setPulse] = useState(false);

  // Simulate live score ticks every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setFixtures(prev =>
        prev.map(f => {
          if (f.status !== "LIVE") return f;
          const scoreChange = Math.random() < 0.1; // 10% chance of a goal
          const minuteAdd  = Math.floor(Math.random() * 3) + 1;
          const newMinute  = Math.min((f.minute || 0) + minuteAdd, 90);
          const isFullTime = newMinute >= 90;
          return {
            ...f,
            minute:    isFullTime ? 90 : newMinute,
            status:    isFullTime ? "FT" : "LIVE",
            homeScore: scoreChange && Math.random() > 0.5 ? f.homeScore + 1 : f.homeScore,
            awayScore: scoreChange && Math.random() <= 0.5 ? f.awayScore + 1 : f.awayScore,
          };
        })
      );
      setLastUpdated(new Date());
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const liveCount = fixtures.filter(f => f.status === "LIVE").length;

  return (
    <div style={{
      background: "rgba(15,23,42,0.6)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: "16px",
      overflow: "hidden",
      boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
      marginTop: "2rem",
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: "14px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(255,255,255,0.01)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "15px" }}>⚽</span>
          <span style={{
            fontSize: "10px", fontWeight: "900", color: "#94a3b8",
            textTransform: "uppercase", letterSpacing: "0.2em"
          }}>
            Live Scores
          </span>
          {liveCount > 0 && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "5px",
              background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)",
              borderRadius: "20px", padding: "2px 8px",
              fontSize: "9px", fontWeight: "800", color: "#10b981",
              textTransform: "uppercase", letterSpacing: "0.15em"
            }}>
              <span style={{
                width: "6px", height: "6px", borderRadius: "50%",
                background: "#10b981",
                animation: "lsw-pulse 1.5s infinite",
                display: "inline-block",
              }} />
              {liveCount} Live
            </span>
          )}
        </div>
        <span style={{
          fontSize: "9px", fontWeight: "700", color: "#475569",
          textTransform: "uppercase", letterSpacing: "0.15em"
        }}>
          Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      {/* ── Fixture Rows ── */}
      <div>
        {fixtures.map((f, idx) => {
          const s = STATUS_STYLES[f.status] || STATUS_STYLES.FT;
          return (
            <div key={f.id} style={{
              padding: "14px 20px",
              display: "flex",
              alignItems: "center",
              gap: "16px",
              borderBottom: idx < fixtures.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none",
              transition: "background 0.2s",
              background: pulse && f.status === "LIVE" ? "rgba(16,185,129,0.02)" : "transparent",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              {/* Status Badge */}
              <div style={{
                minWidth: "46px", textAlign: "center",
                background: s.badge, border: `1px solid ${s.border}`,
                borderRadius: "6px", padding: "3px 6px",
              }}>
                {f.status === "LIVE" ? (
                  <span style={{ fontSize: "9px", fontWeight: "900", color: s.text, letterSpacing: "0.05em" }}>
                    {f.minute}'
                  </span>
                ) : (
                  <span style={{ fontSize: "9px", fontWeight: "900", color: s.text, letterSpacing: "0.05em" }}>
                    {f.status === "UPCOMING" ? f.kickoff : "FT"}
                  </span>
                )}
              </div>

              {/* Home Team */}
              <div style={{ flex: 1, textAlign: "right", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
                <span style={{ fontSize: "12px", fontWeight: "800", color: "#e2e8f0", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {f.homeTeam}
                </span>
                <span style={{ fontSize: "13px" }}>{f.homeBadge}</span>
              </div>

              {/* Score */}
              <div style={{ textAlign: "center", minWidth: "52px" }}>
                {f.status === "UPCOMING" ? (
                  <span style={{ fontSize: "13px", fontWeight: "900", color: "#475569" }}>vs</span>
                ) : (
                  <span style={{
                    fontSize: "16px", fontWeight: "900", color: "#f1f5f9",
                    letterSpacing: "-0.02em",
                    textShadow: f.status === "LIVE" ? "0 0 20px rgba(16,185,129,0.4)" : "none"
                  }}>
                    {f.homeScore} – {f.awayScore}
                  </span>
                )}
              </div>

              {/* Away Team */}
              <div style={{ flex: 1, textAlign: "left", display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "13px" }}>{f.awayBadge}</span>
                <span style={{ fontSize: "12px", fontWeight: "800", color: "#e2e8f0", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {f.awayTeam}
                </span>
              </div>

              {/* League */}
              <span style={{
                minWidth: "80px", textAlign: "right",
                fontSize: "9px", fontWeight: "700", color: "#334155",
                textTransform: "uppercase", letterSpacing: "0.1em"
              }}>
                {f.league}
              </span>
            </div>
          );
        })}
      </div>

      {/* Pulse animation keyframes injected via style tag */}
      <style>{`
        @keyframes lsw-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.85); }
        }
      `}</style>
    </div>
  );
}
