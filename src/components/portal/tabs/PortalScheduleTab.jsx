import React, { useState, useEffect, useMemo, useRef } from "react";
import { Calendar, Clock, MapPin, Trophy, ShieldAlert, Users, Download, ChevronDown, FileText, Image as ImageIcon } from "lucide-react";
import * as XLSX from "@e965/xlsx";
import { toast } from "sonner";
import Card from "../../ui/Card";
import Badge from "../../ui/Badge";
import EmptyState from "../../ui/EmptyState";
import TeamBadge from "../../ui/TeamBadge";
import { TeamPortalAPI } from "../../../services/teamPortalApi";
import { LiveScoresAPI, MatchEventsAPI, DivisionsAPI } from "../../../lib/storage";
import { formatDate } from "../../../lib/utils";
import { getStandingsColumns, getStandingsLegend } from "../../../lib/standingsColumns";

const sanitizeFilename = (name) => (name || "Standings").replace(/[^a-z0-9]/gi, "_");

const STATUS_VARIANTS = {
  Upcoming: "info",
  Live: "danger",
  "Half Time / Break": "warning",
  Finished: "muted",
  Cancelled: "muted",
  Postponed: "warning",
};

const STATUS_FILTER_OPTIONS = ["Upcoming", "Live", "Half Time / Break", "Finished", "Cancelled", "Postponed"];

export default function PortalScheduleTab({ teamId = null, eventId }) {
  const [view, setView] = useState("fixtures");
  const [matches, setMatches] = useState([]);
  const [matchEvents, setMatchEvents] = useState({});
  const [sports, setSports] = useState([]);
  const [selectedSportId, setSelectedSportId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all"); // "all" | "mine"
  const [divisions, setDivisions] = useState([]);
  const [selectedDivisionId, setSelectedDivisionId] = useState("all");
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [standingsExportOpen, setStandingsExportOpen] = useState(false);
  const standingsExportMenuRef = useRef(null);
  const standingsExportCardRef = useRef(null);

  useEffect(() => {
    if (!standingsExportOpen) return;
    const handler = (e) => { if (standingsExportMenuRef.current && !standingsExportMenuRef.current.contains(e.target)) setStandingsExportOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [standingsExportOpen]);

  useEffect(() => {
    if (eventId) load();
  }, [teamId, eventId]);

  useEffect(() => {
    if (eventId && selectedSportId) loadStandings(selectedSportId, selectedDivisionId);
  }, [eventId, selectedSportId, selectedDivisionId]);

  useEffect(() => {
    if (selectedSportId) {
      setSelectedDivisionId("all");
      DivisionsAPI.getBySport(selectedSportId).then(setDivisions).catch(() => setDivisions([]));
    }
  }, [selectedSportId]);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [matchesData, sportsData, teamSportsData, matchEventsData] = await Promise.all([
        LiveScoresAPI.getMatchesWithTeams(eventId),
        LiveScoresAPI.getSports(eventId),
        teamId ? TeamPortalAPI.getPortalTeamSports(teamId) : Promise.resolve([]),
        MatchEventsAPI.getByEvent(eventId),
      ]);
      setMatches(matchesData);
      setSports(sportsData);

      const grouped = {};
      (matchEventsData || []).forEach((ev) => {
        if (!grouped[ev.match_id]) grouped[ev.match_id] = [];
        grouped[ev.match_id].push(ev);
      });
      setMatchEvents(grouped);

      if (sportsData.length > 0) {
        const myNames = new Set((teamSportsData || []).map((s) => s.sport_name.toLowerCase()));
        const match = sportsData.find((s) => myNames.has(s.sport_name.toLowerCase()));
        setSelectedSportId((match || sportsData[0]).id);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load schedule.");
    } finally {
      setLoading(false);
    }
  };

  const loadStandings = async (sportId, divisionId) => {
    try {
      setStandingsLoading(true);
      const data = await TeamPortalAPI.getStandings(eventId, sportId, divisionId !== "all" ? divisionId : null);
      setStandings(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setStandingsLoading(false);
    }
  };

  const selectedStandingsType = useMemo(() => sports.find((s) => s.id === selectedSportId)?.standings_type || "", [sports, selectedSportId]);
  const standingsColumns = useMemo(() => getStandingsColumns(selectedStandingsType), [selectedStandingsType]);
  const standingsSportLabel = useMemo(() => {
    const s = sports.find((sp) => sp.id === selectedSportId);
    return s ? `${s.sport_name}${s.gender ? ` (${s.gender})` : ""}` : "Standings";
  }, [sports, selectedSportId]);

  // Standings has no logo of its own (get_team_standings only returns team
  // names) - reuse the logo/country already present on the fixtures we've
  // loaded for this event, so no extra query is needed.
  const teamLogoMap = useMemo(() => {
    const map = {};
    matches.forEach((m) => {
      if (m.team_a_id) map[m.team_a_id] = { logo_url: m.team_a_logo_url, country: m.team_a_country };
      if (m.team_b_id) map[m.team_b_id] = { logo_url: m.team_b_logo_url, country: m.team_b_country };
    });
    return map;
  }, [matches]);

  const handleExportStandingsExcel = () => {
    if (!standings.length) return;
    setStandingsExportOpen(false);
    const today = new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
    const rows = [
      [`${standingsSportLabel.toUpperCase()} — STANDINGS`],
      [`Generated: ${today}`],
      [],
      ["#", "Team", ...standingsColumns.map((c) => c.header)],
    ];
    standings.forEach((row, i) => {
      rows.push([i + 1, row.team_name, ...standingsColumns.map((c) => (c.format ? c.format(row[c.key]) : row[c.key]))]);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [4, 24, ...standingsColumns.map(() => 10)].map((w) => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Standings");
    XLSX.writeFile(wb, `Standings_${sanitizeFilename(standingsSportLabel)}_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Standings exported");
  };

  const handleExportStandingsPDF = async () => {
    if (!standings.length) return;
    setStandingsExportOpen(false);
    toast.info("Generating PDF…");
    try {
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const today = new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      doc.text(`${standingsSportLabel.toUpperCase()} — STANDINGS`, 14, 18);
      doc.setFontSize(9);
      doc.setTextColor(120, 120, 120);
      doc.text(`Generated: ${today}`, 14, 25);
      autoTable(doc, {
        startY: 30,
        head: [["#", "Team", ...standingsColumns.map((c) => c.header)]],
        body: standings.map((row, i) => [i + 1, row.team_name, ...standingsColumns.map((c) => (c.format ? c.format(row[c.key]) : row[c.key]))]),
        theme: "grid",
        headStyles: { fillColor: [15, 23, 42], textColor: [223, 197, 139], fontStyle: "bold" },
        styles: { fontSize: 9, cellPadding: 2.5 },
      });
      doc.save(`Standings_${sanitizeFilename(standingsSportLabel)}_${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("PDF exported");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF");
    }
  };

  const handleExportStandingsPNG = async () => {
    if (!standings.length || !standingsExportCardRef.current) return;
    setStandingsExportOpen(false);
    toast.info("Generating image…");
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(standingsExportCardRef.current, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const a = document.createElement("a");
      a.download = `Standings_${sanitizeFilename(standingsSportLabel)}_${new Date().toISOString().split("T")[0]}.png`;
      a.href = canvas.toDataURL("image/png", 1.0);
      a.click();
      toast.success("Image exported");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate image");
    }
  };

  const displayedFixtures = useMemo(() => {
    return matches.filter((m) => {
      if (selectedSportId && m.sport_id !== selectedSportId) return false;
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (scopeFilter === "mine" && m.team_a_id !== teamId && m.team_b_id !== teamId) return false;
      return true;
    });
  }, [matches, selectedSportId, statusFilter, scopeFilter, teamId]);

  if (loading) {
    return (
      <div className="p-12 text-center bg-base-alt/30 rounded-2xl border border-border">
        <div className="w-8 h-8 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-muted">Loading schedule...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12 text-center bg-base-alt/30 rounded-2xl border border-border">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-main font-medium">Error loading schedule</p>
        <p className="text-muted text-sm">{error}</p>
      </div>
    );
  }

  if (sports.length === 0) {
    return (
      <div className="p-12 text-center bg-base-alt/30 rounded-2xl border border-border">
        <Calendar className="w-12 h-12 text-muted mx-auto mb-3" />
        <p className="text-main font-medium">Schedule not configured yet</p>
        <p className="text-muted text-sm">The event organizer hasn't added any sports to Live Scores yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-bold text-main">Schedule & Standings</h2>
          <p className="text-sm text-muted">
            {teamId ? "Fixtures and the league table for your sport." : "Fixtures and league tables for every sport in this event."}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-base-alt/50 border border-border rounded-lg p-1">
            <button
              onClick={() => setView("fixtures")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "fixtures" ? "bg-primary-500 text-white" : "text-muted hover:text-main"}`}
            >
              Fixtures
            </button>
            <button
              onClick={() => setView("standings")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "standings" ? "bg-primary-500 text-white" : "text-muted hover:text-main"}`}
            >
              Standings
            </button>
          </div>

          {view === "standings" && standings.length > 0 && (
            <div className="relative" ref={standingsExportMenuRef}>
              <button
                onClick={() => setStandingsExportOpen((p) => !p)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-base-alt border border-border text-muted hover:text-main rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Export <ChevronDown className="w-3 h-3" />
              </button>
              {standingsExportOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-30 bg-base border border-border rounded-xl shadow-2xl p-2 min-w-[190px] space-y-0.5">
                  <button onClick={handleExportStandingsExcel} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-base-alt rounded-lg text-sm text-main transition-colors text-left">
                    <Download className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> <span>Excel (.xlsx)</span>
                  </button>
                  <button onClick={handleExportStandingsPDF} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-base-alt rounded-lg text-sm text-main transition-colors text-left">
                    <FileText className="w-3.5 h-3.5 text-red-500 shrink-0" /> <span>PDF</span>
                  </button>
                  <button onClick={handleExportStandingsPNG} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-base-alt rounded-lg text-sm text-main transition-colors text-left">
                    <ImageIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" /> <span>JPG / PNG</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap bg-base-alt/30 border border-border rounded-xl p-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-muted uppercase tracking-wider">Sport</label>
          <select
            value={selectedSportId}
            onChange={(e) => setSelectedSportId(e.target.value)}
            className="px-3 py-1.5 bg-base border border-border rounded-lg text-sm text-main focus:outline-none focus:border-primary-500"
          >
            {sports.map((s) => (
              <option key={s.id} value={s.id}>{s.sport_name}{s.gender ? ` (${s.gender})` : ""}</option>
            ))}
          </select>
        </div>

        {view === "standings" && divisions.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Division</label>
            <select
              value={selectedDivisionId}
              onChange={(e) => setSelectedDivisionId(e.target.value)}
              className="px-3 py-1.5 bg-base border border-border rounded-lg text-sm text-main focus:outline-none focus:border-primary-500"
            >
              <option value="all">All Divisions</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>{d.name}{d.gender ? ` (${d.gender})` : ""}</option>
              ))}
            </select>
          </div>
        )}

        {view === "fixtures" && (
          <>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-base border border-border rounded-lg text-sm text-main focus:outline-none focus:border-primary-500"
              >
                <option value="all">All Statuses</option>
                {STATUS_FILTER_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {teamId && (
              <div className="flex items-center gap-2 bg-base border border-border rounded-lg p-1 ml-auto">
                <button
                  onClick={() => setScopeFilter("all")}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${scopeFilter === "all" ? "bg-primary-500 text-white" : "text-muted hover:text-main"}`}
                >
                  All Teams
                </button>
                <button
                  onClick={() => setScopeFilter("mine")}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 ${scopeFilter === "mine" ? "bg-primary-500 text-white" : "text-muted hover:text-main"}`}
                >
                  <Users className="w-3 h-3" /> My Team Only
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {view === "fixtures" ? (
        <Card>
          {displayedFixtures.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No Fixtures Found"
              description="No fixtures match the selected filters yet."
            />
          ) : (
            <div className="divide-y divide-border/50">
              {displayedFixtures.map((m) => (
                <div key={m.id} className="p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={STATUS_VARIANTS[m.status] || "info"}>{m.status}</Badge>
                    {m.match_title && <span className="text-xs text-muted">{m.match_title}</span>}
                    {m.division_name && (
                      <span className="text-xs font-semibold text-primary-500">
                        {m.area_name ? `${m.area_name} – ${m.division_name}` : m.division_name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <div className="flex items-center justify-end gap-2 flex-1 min-w-0">
                      <p className="font-semibold text-main text-right truncate">{m.team_a_name || "TBA"}</p>
                      <TeamBadge logoUrl={m.team_a_logo_url} country={m.team_a_country} name={m.team_a_name} size="sm" />
                    </div>
                    {(m.status === "Live" || m.status === "Half Time / Break" || m.status === "Finished") ? (
                      <div className="text-center px-3 py-1.5 bg-base-alt/50 rounded-lg border border-border shrink-0">
                        <span className="text-lg font-black text-main">{m.team_a_score} - {m.team_b_score}</span>
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-muted shrink-0 px-3">vs</span>
                    )}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <TeamBadge logoUrl={m.team_b_logo_url} country={m.team_b_country} name={m.team_b_name} size="sm" />
                      <p className="font-semibold text-main truncate">{m.team_b_name || "TBA"}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-3 text-xs text-muted flex-wrap">
                    {m.match_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {formatDate(m.match_date)}
                      </span>
                    )}
                    {m.match_time && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {m.match_time}
                      </span>
                    )}
                    {m.venue && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {m.venue}
                      </span>
                    )}
                  </div>
                  {(matchEvents[m.id] || []).length > 0 && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center text-xs text-muted border-t border-border/50 pt-2">
                      {matchEvents[m.id].map((ev) => (
                        <span key={ev.id} className="flex items-center gap-1">
                          <span className="text-primary-500 font-semibold">{ev.event_type}</span> {ev.player_name}
                          {ev.minute ? ` ${ev.minute}'` : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-4 space-y-4">
          {standingsLoading ? (
            <p className="text-muted text-sm p-4">Loading standings...</p>
          ) : standings.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="No Standings Yet"
              description="The league table will appear once matches between teams are marked Finished."
            />
          ) : (
            <div ref={standingsExportCardRef} className="bg-base p-2 space-y-3">
              <p className="text-xs font-bold text-main uppercase tracking-wider">{standingsSportLabel} — Standings</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted text-xs uppercase tracking-widest">
                      <th className="py-2 pr-4">#</th>
                      <th className="py-2 pr-4">Team</th>
                      {standingsColumns.map((col) => (
                        <th key={col.key} className="py-2 pr-3 text-center" title={col.title}>{col.header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {standings.map((row, i) => (
                      <tr key={row.team_id} className={row.team_id === teamId ? "bg-primary-500/5 font-bold text-main" : "text-main"}>
                        <td className="py-2 pr-4 text-muted">{i + 1}</td>
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            <TeamBadge logoUrl={teamLogoMap[row.team_id]?.logo_url} country={teamLogoMap[row.team_id]?.country} name={row.team_name} size="sm" />
                            <span>{row.team_name}</span>
                          </div>
                        </td>
                        {standingsColumns.map((col) => (
                          <td key={col.key} className={`py-2 pr-3 text-center ${col.highlight ? "font-black text-primary-500" : ""}`}>
                            {col.format ? col.format(row[col.key]) : row[col.key]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted leading-relaxed">{getStandingsLegend(selectedStandingsType)}</p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
