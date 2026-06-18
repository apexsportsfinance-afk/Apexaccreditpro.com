import React, { useState, useEffect, useRef, useMemo } from "react";
import * as XLSX from "@e965/xlsx";
import { Plus, Trash2, Save, Calendar, Clock, Edit2, Play, CheckCircle, XCircle, ChevronDown, ChevronUp, Trophy, Search, RotateCcw, Wand2, Info, Download, FileText, Image } from "lucide-react";
import FixturePNGCard from "./FixturePNGCard";
import { motion, AnimatePresence } from "framer-motion";
import { LiveScoresAPI, DivisionsAPI, MatchEventsAPI, DisciplinaryAPI, PlayerStatsAPI } from "../../lib/storage";
import { TeamAPI } from "../../services/teamApi";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import TeamBadge from "../ui/TeamBadge";
import MatchEventsPanel from "./MatchEventsPanel";
import GenerateFixturesModal from "./GenerateFixturesModal";
import { useAuth } from "../../contexts/AuthContext";
import { STANDINGS_TYPE_OPTIONS, getStandingsColumns, getStandingsLegend } from "../../lib/standingsColumns";
import { getStatFieldsForSport } from "../../lib/sportStatFields";

export default function LiveScoresTab({ eventId, onToast, disabled }) {
  const { user } = useAuth();
  // If the user's role is "Score Operator", they can only update scores and status.
  const isScoreOperator = user?.role === "Score Operator";
  // The user cannot edit settings/delete if they are generally disabled OR a score operator.
  const isSettingsDisabled = disabled || isScoreOperator;

  const [settings, setSettings] = useState({ event_id: eventId, live_scores_enabled: false });
  const [sports, setSports] = useState([]);
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [collapsedSports, setCollapsedSports] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [newSport, setNewSport] = useState({ sport_name: "", gender: "", standings_type: "" });
  const [editingMatch, setEditingMatch] = useState(null);

  const [standingsSportId, setStandingsSportId] = useState("");
  const [standings, setStandings] = useState([]);
  const [standingsLoading, setStandingsLoading] = useState(false);

  // Phase 3: divisions / configurable points
  const [standingsDivisionId, setStandingsDivisionId] = useState("all");
  const [divisions, setDivisions] = useState([]);
  const [pointsConfig, setPointsConfig] = useState({ points_win: 3, points_draw: 1, points_loss: 0 });
  const [savingPoints, setSavingPoints] = useState(false);
  const [teamDivisions, setTeamDivisions] = useState({});
  const [newDivisionName, setNewDivisionName] = useState("");
  const [newDivisionGender, setNewDivisionGender] = useState("");
  const [showDivisionSettings, setShowDivisionSettings] = useState(false);

  // Phase 4: competition format builder / fixture generation
  const [generateFixturesSport, setGenerateFixturesSport] = useState(null);

  // League management
  const [leagueManageSportId, setLeagueManageSportId] = useState("");
  const [renameLeagueModal, setRenameLeagueModal] = useState({ open: false, sportId: null, oldName: "", newName: "" });
  const [renamingLeague, setRenamingLeague] = useState(false);

  const [matchForm, setMatchForm] = useState({
    sport_id: "",
    match_title: "",
    league_name: "",
    team_a_id: "",
    team_a_name: "",
    team_b_id: "",
    team_b_name: "",
    team_a_score: "0",
    team_b_score: "0",
    match_date: new Date().toISOString().split('T')[0],
    match_time: "12:00",
    venue: "",
    status: "Upcoming",
    notes: ""
  });

  const STATUS_OPTIONS = ["Upcoming", "Live", "Half Time / Break", "Finished", "Cancelled", "Postponed"];

  // Matches list filters
  const [filterSportId, setFilterSportId] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDate, setFilterDate] = useState("");
  const [filterTeamId, setFilterTeamId] = useState("all");
  const [filterSearch, setFilterSearch] = useState("");
  const [quickView, setQuickView] = useState("all");

  // Export menu + PNG modal
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [pngModal, setPngModal] = useState({ open: false, sportId: "", leagueName: "", status: "" });
  const [pngData, setPngData] = useState(null);
  const [pngGenerating, setPngGenerating] = useState(false);
  const exportMenuRef = useRef(null);

  useEffect(() => {
    loadData();
  }, [eventId]);

  useEffect(() => {
    if (sports.length > 0 && !standingsSportId) {
      setStandingsSportId(sports[0].id);
    }
  }, [sports]);

  useEffect(() => {
    if (eventId && standingsSportId) loadStandings(standingsSportId, standingsDivisionId);
  }, [eventId, standingsSportId, standingsDivisionId, matches]);

  useEffect(() => {
    if (standingsSportId) loadSportExtras(standingsSportId);
  }, [standingsSportId, teams]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sData, spData, mData, tData] = await Promise.all([
        LiveScoresAPI.getSettings(eventId),
        LiveScoresAPI.getSports(eventId),
        LiveScoresAPI.getMatches(eventId),
        TeamAPI.getTeamsByEvent(eventId)
      ]);
      if (sData) setSettings(sData);
      if (spData) setSports(spData);
      if (mData) setMatches(mData);
      if (tData) setTeams(tData);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load Live Scores data");
    } finally {
      setLoading(false);
    }
  };

  const loadStandings = async (sportId, divisionId) => {
    setStandingsLoading(true);
    try {
      const data = await LiveScoresAPI.getStandings(eventId, sportId, divisionId !== "all" ? divisionId : null);
      setStandings(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setStandingsLoading(false);
    }
  };

  // Load this sport's divisions, points config, and per-team division
  // assignments (for the "Configure Divisions & Points" panel).
  const loadSportExtras = async (sportId) => {
    setStandingsDivisionId("all");
    try {
      const [divs, cfg] = await Promise.all([
        DivisionsAPI.getBySport(sportId),
        LiveScoresAPI.getPointsConfig(eventId, sportId)
      ]);
      setDivisions(divs);
      setPointsConfig(cfg || { points_win: 3, points_draw: 1, points_loss: 0 });

      const sport = sports.find(s => s.id === sportId);
      if (sport && teams.length > 0) {
        const tds = await LiveScoresAPI.getTeamSportDivisions(teams.map(t => t.id), sport.sport_name);
        const map = {};
        tds.forEach(td => { map[td.team_id] = td.division_id || ""; });
        setTeamDivisions(map);
      } else {
        setTeamDivisions({});
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSavePoints = async () => {
    if (isSettingsDisabled || !standingsSportId) return;
    setSavingPoints(true);
    try {
      const saved = await LiveScoresAPI.savePointsConfig({
        event_id: eventId,
        sport_id: standingsSportId,
        points_win: Number(pointsConfig.points_win) || 0,
        points_draw: Number(pointsConfig.points_draw) || 0,
        points_loss: Number(pointsConfig.points_loss) || 0,
      });
      setPointsConfig(saved);
      toast.success("Points system saved");
    } catch (err) {
      toast.error("Failed to save points system");
    } finally {
      setSavingPoints(false);
    }
  };

  const handleAddDivision = async () => {
    if (isSettingsDisabled || !standingsSportId || !newDivisionName.trim()) return;
    try {
      const saved = await DivisionsAPI.save({
        event_id: eventId,
        sport_id: standingsSportId,
        name: newDivisionName.trim(),
        gender: newDivisionGender || null,
        display_order: divisions.length,
      });
      setDivisions([...divisions, saved]);
      setNewDivisionName("");
      setNewDivisionGender("");
      toast.success("Division added");
    } catch (err) {
      toast.error("Failed to add division");
    }
  };

  const handleDeleteDivision = async (id) => {
    if (isSettingsDisabled) return;
    if (!window.confirm("Delete this division? Teams assigned to it will become unassigned.")) return;
    try {
      await DivisionsAPI.delete(id);
      setDivisions(divisions.filter(d => d.id !== id));
      setTeamDivisions(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(tid => { if (next[tid] === id) next[tid] = ""; });
        return next;
      });
      if (standingsDivisionId === id) setStandingsDivisionId("all");
    } catch (err) {
      toast.error("Failed to delete division");
    }
  };

  const handleTeamDivisionChange = async (teamId, divisionId) => {
    if (isSettingsDisabled) return;
    const sport = sports.find(s => s.id === standingsSportId);
    if (!sport) return;
    setTeamDivisions(prev => ({ ...prev, [teamId]: divisionId }));
    try {
      await LiveScoresAPI.setTeamSportDivision(teamId, sport.sport_name, divisionId || null);
    } catch (err) {
      toast.error("Failed to update team's division");
    }
  };

  const saveSettings = async () => {
    if (isSettingsDisabled) return;
    setSaving(true);
    try {
      await LiveScoresAPI.saveSettings(settings);
      toast.success("Live Score Settings saved!");
    } catch (err) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleAddSport = async () => {
    if (isSettingsDisabled || !newSport.sport_name.trim()) return;
    try {
      const added = await LiveScoresAPI.saveSport({ event_id: eventId, sport_name: newSport.sport_name.trim(), gender: newSport.gender || null, standings_type: newSport.standings_type || null });
      setSports([...sports, added]);
      setNewSport({ sport_name: "", gender: "", standings_type: "" });
      toast.success("Sport added");
    } catch (err) {
      toast.error("Failed to add sport");
    }
  };

  const handleUpdateStandingsType = async (sportId, standingsType) => {
    if (isSettingsDisabled) return;
    try {
      const updated = await LiveScoresAPI.saveSport({ id: sportId, standings_type: standingsType || null });
      setSports(prev => prev.map(s => s.id === sportId ? updated : s));
      toast.success("Standings type updated");
    } catch (err) {
      toast.error("Failed to update standings type");
    }
  };

  // Phase 4: called after the Generate Fixtures modal creates new matches
  // and/or saves the sport's chosen format. Additive only - never removes
  // existing matches.
  const handleFixturesGenerated = (insertedMatches, updatedSport, replaced) => {
    if (replaced) {
      // Remove deleted matches from state first, then append new ones
      setMatches(prev => {
        const filtered = replaced.leagueName
          ? prev.filter(m => !(m.sport_id === replaced.sportId && m.league_name === replaced.leagueName))
          : prev.filter(m => m.sport_id !== replaced.sportId);
        return [...filtered, ...(insertedMatches || [])];
      });
    } else if (insertedMatches && insertedMatches.length > 0) {
      setMatches(prev => [...prev, ...insertedMatches]);
    }
    if (updatedSport) {
      setSports(prev => prev.map(s => s.id === updatedSport.id ? updatedSport : s));
    }
  };

  const handleDeleteSport = async (id) => {
    if (isSettingsDisabled) return;
    if (!window.confirm("Are you sure? This will delete all matches for this sport!")) return;
    try {
      await LiveScoresAPI.deleteSport(id);
      setSports(sports.filter(s => s.id !== id));
      setMatches(matches.filter(m => m.sport_id !== id));
      toast.success("Sport deleted");
    } catch (err) {
      toast.error("Failed to delete sport");
    }
  };

  const handleSaveMatch = async () => {
    if (disabled) return;
    if (!matchForm.sport_id || !matchForm.match_title) {
      toast.error("Sport and Match Title are required");
      return;
    }
    try {
      const payload = { ...matchForm, event_id: eventId, team_a_id: matchForm.team_a_id || null, team_b_id: matchForm.team_b_id || null, league_name: matchForm.league_name.trim() || null };
      if (editingMatch) payload.id = editingMatch.id;

      const saved = await LiveScoresAPI.saveMatch(payload);
      
      if (editingMatch) {
        setMatches(matches.map(m => m.id === saved.id ? saved : m));
      } else {
        setMatches([...matches, saved]);
      }
      
      toast.success("Match saved successfully");
      resetMatchForm();
    } catch (err) {
      toast.error("Failed to save match");
    }
  };

  const handleDeleteMatch = async (id) => {
    if (isSettingsDisabled) return;
    if (!window.confirm("Delete this match?")) return;
    try {
      await LiveScoresAPI.deleteMatch(id);
      setMatches(matches.filter(m => m.id !== id));
      toast.success("Match deleted");
    } catch (err) {
      toast.error("Failed to delete match");
    }
  };

  const editMatch = (m) => {
    setEditingMatch(m);
    setMatchForm({
      sport_id: m.sport_id || "",
      match_title: m.match_title || "",
      league_name: m.league_name || "",
      team_a_id: m.team_a_id || "",
      team_a_name: m.team_a_name || "",
      team_b_id: m.team_b_id || "",
      team_b_name: m.team_b_name || "",
      team_a_score: m.team_a_score || "0",
      team_b_score: m.team_b_score || "0",
      match_date: m.match_date || "",
      match_time: m.match_time || "",
      venue: m.venue || "",
      status: m.status || "Upcoming",
      notes: m.notes || ""
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetMatchForm = () => {
    setEditingMatch(null);
    setMatchForm({
      sport_id: sports.length > 0 ? sports[0].id : "",
      match_title: "",
      league_name: "",
      team_a_id: "",
      team_a_name: "",
      team_b_id: "",
      team_b_name: "",
      team_a_score: "0",
      team_b_score: "0",
      match_date: new Date().toISOString().split('T')[0],
      match_time: "12:00",
      venue: "",
      status: "Upcoming",
      notes: ""
    });
  };

  // Derive leagues from current matches state (no extra DB query needed)
  const getLeaguesForSport = (sportId) =>
    [...new Set(matches.filter(m => m.sport_id === sportId && m.league_name?.trim()).map(m => m.league_name.trim()))].sort();

  const handleRenameLeague = async () => {
    const { sportId, oldName, newName } = renameLeagueModal;
    if (!newName.trim() || newName.trim() === oldName) { setRenameLeagueModal({ open: false, sportId: null, oldName: "", newName: "" }); return; }
    setRenamingLeague(true);
    try {
      await LiveScoresAPI.renameLeague(eventId, sportId, oldName, newName.trim());
      setMatches(prev => prev.map(m => m.sport_id === sportId && m.league_name === oldName ? { ...m, league_name: newName.trim() } : m));
      toast.success("League renamed");
      setRenameLeagueModal({ open: false, sportId: null, oldName: "", newName: "" });
    } catch (err) {
      toast.error("Failed to rename league");
    } finally {
      setRenamingLeague(false);
    }
  };

  const handleDeleteLeague = async (sportId, leagueName) => {
    const count = matches.filter(m => m.sport_id === sportId && m.league_name === leagueName).length;
    if (!window.confirm(`Delete league "${leagueName}"? This will permanently delete all ${count} match${count !== 1 ? 'es' : ''} in it.`)) return;
    try {
      await LiveScoresAPI.deleteLeague(eventId, sportId, leagueName);
      setMatches(prev => prev.filter(m => !(m.sport_id === sportId && m.league_name === leagueName)));
      toast.success(`League "${leagueName}" deleted`);
    } catch (err) {
      toast.error("Failed to delete league");
    }
  };

  const handleDeleteNoLeagueMatches = async (sportId) => {
    const count = matches.filter(m => m.sport_id === sportId && !m.league_name?.trim()).length;
    if (!window.confirm(`Delete all ${count} match${count !== 1 ? 'es' : ''} with no league/fixture name for this sport? This cannot be undone.`)) return;
    try {
      await LiveScoresAPI.deleteMatchesBySportNoLeague(eventId, sportId);
      setMatches(prev => prev.filter(m => !(m.sport_id === sportId && !m.league_name?.trim())));
      toast.success(`${count} unassigned match${count !== 1 ? 'es' : ''} deleted`);
    } catch (err) {
      toast.error("Failed to delete matches");
    }
  };

  const handleDeleteAllSportMatches = async (sportId) => {
    const sport = sports.find(s => s.id === sportId);
    const count = matches.filter(m => m.sport_id === sportId).length;
    if (!window.confirm(`DELETE ALL ${count} MATCHES for ${sport?.sport_name || "this sport"}? This permanently removes every fixture and cannot be undone.`)) return;
    try {
      await LiveScoresAPI.deleteAllMatchesBySport(eventId, sportId);
      setMatches(prev => prev.filter(m => m.sport_id !== sportId));
      toast.success(`All matches for ${sport?.sport_name || "sport"} deleted`);
    } catch (err) {
      toast.error("Failed to delete matches");
    }
  };

  const handleExportFixtures = async (exportAll = true) => {
    const source = exportAll ? matches : filteredMatches;
    if (source.length === 0) { toast.error("No matches to export"); return; }

    toast.info("Preparing export…");

    // Fetch all events and disciplinary records for this event in parallel
    let allEvents = [], allCards = [];
    try {
      [allEvents, allCards] = await Promise.all([
        MatchEventsAPI.getByEvent(eventId),
        DisciplinaryAPI.getByEvent(eventId),
      ]);
    } catch {
      // Non-fatal — export without events/cards if fetch fails
    }

    // Build match_id → events/cards lookup maps
    const eventsMap = {};
    allEvents.forEach(ev => { (eventsMap[ev.match_id] = eventsMap[ev.match_id] || []).push(ev); });
    const cardsMap = {};
    allCards.forEach(c => { (cardsMap[c.match_id] = cardsMap[c.match_id] || []).push(c); });

    const fmtEvents = (matchId) =>
      (eventsMap[matchId] || [])
        .map(ev => `${ev.event_type}: ${ev.player_name}${ev.team_name ? ` (${ev.team_name})` : ""}${ev.minute ? ` ${ev.minute}'` : ""}${ev.notes ? ` [${ev.notes}]` : ""}`)
        .join(";  ") || "";

    const fmtCards = (matchId) =>
      (cardsMap[matchId] || [])
        .map(c => `${c.card_type} Card: ${c.player_name}${c.team_name ? ` (${c.team_name})` : ""}${c.minute ? ` ${c.minute}'` : ""}${c.reason ? ` [${c.reason}]` : ""}`)
        .join(";  ") || "";

    const wb = XLSX.utils.book_new();
    const today = new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
    const buildGroups = (sportId, sourceList) => {
      const sportLeagues = getLeaguesForSport(sportId).filter(l => sourceList.some(m => m.league_name === l));
      const leagueless = sourceList.filter(m => !m.league_name?.trim());
      return [
        ...sportLeagues.map(l => ({ label: l, items: sourceList.filter(m => m.league_name === l) })),
        ...(leagueless.length > 0 ? [{ label: null, items: leagueless }] : [])
      ];
    };

    // ── Sheet 1: All Fixtures ──────────────────────────────────────────────
    const allRows = [
      ["FIXTURE SCHEDULE — FULL OVERVIEW"],
      [`Generated: ${today}`, "", "", exportAll ? `Total matches: ${matches.length}` : `Filtered view: ${filteredMatches.length} of ${matches.length} matches`],
      [],
      ["#", "Sport", "League / Fixture", "Phase / Round", "Date", "Time", "Venue", "Team A", "Score A", "Score B", "Team B", "Status", "Goals / Scorers", "Cards"],
    ];
    let num = 1;
    sports.forEach(sport => {
      const sm = source.filter(m => m.sport_id === sport.id);
      if (sm.length === 0) return;
      const sportLabel = `${sport.sport_name}${sport.gender ? ` (${sport.gender})` : ""}`;
      allRows.push([]);
      allRows.push([`▸ ${sportLabel.toUpperCase()}`]);
      buildGroups(sport.id, sm).forEach(({ label, items }) => {
        if (label) allRows.push(["", `  ◦ ${label}`, "", `(${items.length} matches)`]);
        items.forEach(m => allRows.push([
          num++, sportLabel, label || "", m.match_title || "",
          m.match_date || "", m.match_time || "", m.venue || "",
          m.team_a_name || "", m.team_a_score ?? "0", m.team_b_score ?? "0", m.team_b_name || "",
          m.status || "", fmtEvents(m.id), fmtCards(m.id)
        ]));
      });
    });
    const ws1 = XLSX.utils.aoa_to_sheet(allRows);
    ws1["!cols"] = [4, 22, 24, 22, 12, 8, 20, 24, 8, 8, 24, 14, 40, 40].map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws1, "All Fixtures");

    // ── One sheet per sport ───────────────────────────────────────────────
    sports.forEach(sport => {
      const sm = source.filter(m => m.sport_id === sport.id)
        .sort((a, b) => `${a.match_date} ${a.match_time}`.localeCompare(`${b.match_date} ${b.match_time}`));
      if (sm.length === 0) return;
      const sportLabel = `${sport.sport_name}${sport.gender ? ` (${sport.gender})` : ""}`;
      const rows = [
        [`${sportLabel.toUpperCase()} — FIXTURE SCHEDULE`],
        [`Generated: ${today}`, "", `Total: ${sm.length} matches`],
        [],
        ["#", "League / Fixture", "Phase / Round", "Date", "Time", "Venue", "Team A", "Score A", "Score B", "Team B", "Status", "Goals / Scorers", "Cards"],
      ];
      let n = 1;
      buildGroups(sport.id, sm).forEach(({ label, items }) => {
        rows.push([]);
        if (label) rows.push(["", `${label}`, "", `${items.length} matches`]);
        items.forEach(m => rows.push([
          n++, label || "", m.match_title || "",
          m.match_date || "", m.match_time || "", m.venue || "",
          m.team_a_name || "", m.team_a_score ?? "0", m.team_b_score ?? "0", m.team_b_name || "",
          m.status || "", fmtEvents(m.id), fmtCards(m.id)
        ]));
      });
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [4, 24, 22, 12, 8, 20, 24, 8, 8, 24, 14, 40, 40].map(w => ({ wch: w }));
      const sheetName = sportLabel.replace(/[:\\/?*[\]]/g, "").slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    const filename = `Fixtures_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
    toast.success(`Exported ${source.length} matches to ${filename}`);
  };

  // ── Player Stats Export ─────────────────────────────────────────────────
  const handleExportPlayerStats = async () => {
    toast.info("Preparing player stats export…");
    let allStats = [];
    try {
      allStats = await PlayerStatsAPI.getByEvent(eventId);
    } catch {
      toast.error("Failed to load player stats");
      return;
    }
    if (!allStats.length) { toast.error("No player stats recorded yet"); return; }

    const matchesById = {};
    matches.forEach(m => { matchesById[m.id] = m; });

    const wb = XLSX.utils.book_new();
    const today = new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
    let sheetsAdded = 0;

    sports.forEach(sport => {
      const sportStats = allStats.filter(s => s.sport_id === sport.id);
      if (!sportStats.length) return;
      const fields = getStatFieldsForSport(sport.standings_type);
      const sportLabel = `${sport.sport_name}${sport.gender ? ` (${sport.gender})` : ""}`;
      const safeName = sportLabel.replace(/[:\\/?*[\]]/g, "");

      const matchRows = [
        [`${sportLabel.toUpperCase()} — PLAYER STATS BY MATCH`],
        [`Generated: ${today}`, "", `Total entries: ${sportStats.length}`],
        [],
        ["Player", "Team", "Match", "Date", "Played", ...fields.map(f => f.label)],
      ];
      sportStats.forEach(s => {
        const m = matchesById[s.match_id];
        matchRows.push([
          s.player_name, s.team_name || "", m?.match_title || "", m?.match_date || "",
          s.participated ? "Yes" : "No",
          ...fields.map(f => s.stats?.[f.key] ?? 0),
        ]);
      });
      const wsMatch = XLSX.utils.aoa_to_sheet(matchRows);
      wsMatch["!cols"] = [22, 20, 20, 12, 8, ...fields.map(() => 10)].map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, wsMatch, `${safeName.slice(0, 25)} - By Match`);

      const totalsMap = {};
      sportStats.forEach(s => {
        const key = s.player_accreditation_id;
        if (!totalsMap[key]) totalsMap[key] = { player_name: s.player_name, team_name: s.team_name, matches_played: 0, stats: {} };
        totalsMap[key].matches_played += s.participated ? 1 : 0;
        fields.forEach(f => {
          totalsMap[key].stats[f.key] = (totalsMap[key].stats[f.key] || 0) + (Number(s.stats?.[f.key]) || 0);
        });
      });
      const totalsRows = [
        [`${sportLabel.toUpperCase()} — SEASON TOTALS`],
        [`Generated: ${today}`],
        [],
        ["Player", "Team", "Matches Played", ...fields.map(f => f.label)],
      ];
      Object.values(totalsMap)
        .sort((a, b) => a.player_name.localeCompare(b.player_name))
        .forEach(t => totalsRows.push([t.player_name, t.team_name || "", t.matches_played, ...fields.map(f => t.stats[f.key] || 0)]));
      const wsTotals = XLSX.utils.aoa_to_sheet(totalsRows);
      wsTotals["!cols"] = [22, 20, 14, ...fields.map(() => 10)].map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, wsTotals, `${safeName.slice(0, 25)} - Totals`);
      sheetsAdded++;
    });

    if (!sheetsAdded) { toast.error("No player stats recorded yet"); return; }

    const filename = `PlayerStats_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
    toast.success("Player stats exported");
  };

  // ── PDF Export ──────────────────────────────────────────────────────────
  const handleExportPDF = async (exportAll = true) => {
    const source = exportAll ? matches : filteredMatches;
    if (!source.length) { toast.error("No matches to export"); return; }
    setExportMenuOpen(false);
    toast.info("Generating PDF…");

    let allEvents = [], allCards = [];
    try {
      [allEvents, allCards] = await Promise.all([
        MatchEventsAPI.getByEvent(eventId),
        DisciplinaryAPI.getByEvent(eventId),
      ]);
    } catch {}

    const evMap = {};
    allEvents.forEach(ev => { (evMap[ev.match_id] = evMap[ev.match_id] || []).push(ev); });
    const cMap = {};
    allCards.forEach(c => { (cMap[c.match_id] = cMap[c.match_id] || []).push(c); });
    const fmtEv = (id) => (evMap[id] || []).map(ev => `${ev.event_type}: ${ev.player_name}${ev.team_name ? ` (${ev.team_name})` : ""}${ev.minute ? ` ${ev.minute}'` : ""}`).join(", ");
    const fmtC  = (id) => (cMap[id] || []).map(c => `${c.card_type}: ${c.player_name}${c.team_name ? ` (${c.team_name})` : ""}${c.minute ? ` ${c.minute}'` : ""}`).join(", ");

    try {
      const { jsPDF } = await import("jspdf");
      const autoTable  = (await import("jspdf-autotable")).default;

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const today = new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" });
      const DARK  = [15, 23, 42];
      const GOLD  = [223, 197, 139];
      const LITE  = [241, 245, 249];
      const PAGE_W = doc.internal.pageSize.getWidth();
      const PAGE_H = doc.internal.pageSize.getHeight();

      const buildGroups = (sportId, src) => {
        const lgs = getLeaguesForSport(sportId).filter(l => src.some(m => m.league_name === l));
        const ll  = src.filter(m => !m.league_name?.trim());
        return [
          ...lgs.map(l => ({ label: l, items: src.filter(m => m.league_name === l) })),
          ...(ll.length > 0 ? [{ label: null, items: ll }] : []),
        ];
      };

      let first = true;
      sports.forEach(sport => {
        const sm = source.filter(m => m.sport_id === sport.id)
          .sort((a, b) => `${a.match_date} ${a.match_time}`.localeCompare(`${b.match_date} ${b.match_time}`));
        if (!sm.length) return;
        const sportLabel = `${sport.sport_name}${sport.gender ? ` (${sport.gender})` : ""}`;

        buildGroups(sport.id, sm).forEach(({ label, items }) => {
          if (!first) doc.addPage();
          first = false;

          // Dark header band
          doc.setFillColor(...DARK);
          doc.rect(0, 0, PAGE_W, 24, "F");
          doc.setFontSize(15);
          doc.setTextColor(...GOLD);
          doc.setFont("helvetica", "bold");
          doc.text(`${sportLabel.toUpperCase()}${label ? `  —  ${label}` : ""}`, 10, 14);
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.setFont("helvetica", "normal");
          doc.text(`${today}   ·   ${items.length} match${items.length !== 1 ? "es" : ""}`, 10, 21);

          // Table
          let n = 1;
          autoTable(doc, {
            startY: 27,
            head: [["#", "Phase / Round", "Date", "Time", "Venue", "Team A", "Score", "Team B", "Status", "Goals / Scorers", "Cards"]],
            body: items.map(m => [
              n++,
              m.match_title || "",
              m.match_date  || "",
              (m.match_time || "").slice(0, 5),
              m.venue       || "",
              m.team_a_name || "TBA",
              `${m.team_a_score ?? 0} – ${m.team_b_score ?? 0}`,
              m.team_b_name || "TBA",
              m.status      || "",
              fmtEv(m.id),
              fmtC(m.id),
            ]),
            theme: "grid",
            styles: { fontSize: 7.5, cellPadding: 2, textColor: DARK, overflow: "linebreak" },
            headStyles: { fillColor: DARK, textColor: GOLD, fontStyle: "bold", fontSize: 8 },
            alternateRowStyles: { fillColor: LITE },
            columnStyles: {
              0:  { cellWidth: 7,  halign: "center", overflow: "hidden" },
              1:  { cellWidth: 30, overflow: "ellipsize" },
              2:  { cellWidth: 20, overflow: "hidden" },
              3:  { cellWidth: 16, halign: "center", overflow: "hidden" },
              4:  { cellWidth: 20, overflow: "ellipsize" },
              5:  { cellWidth: 36, overflow: "ellipsize" },
              6:  { cellWidth: 15, halign: "center", fontStyle: "bold", overflow: "hidden" },
              7:  { cellWidth: 36, overflow: "ellipsize" },
              8:  { cellWidth: 18, overflow: "hidden" },
              9:  { cellWidth: "auto" },
              10: { cellWidth: "auto" },
            },
            didDrawPage: (data) => {
              doc.setFontSize(7);
              doc.setTextColor(150, 150, 150);
              doc.text("APEX SPORTS ACADEMY", 10, PAGE_H - 5);
              doc.text(`Page ${data.pageNumber}`, PAGE_W - 10, PAGE_H - 5, { align: "right" });
            },
          });
        });
      });

      doc.save(`Fixtures_${new Date().toISOString().split("T")[0]}.pdf`);
      toast.success("PDF exported");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF");
    }
  };

  // ── PNG Export ──────────────────────────────────────────────────────────
  // Triggered after pngData state is set (card is then rendered in the DOM).
  useEffect(() => {
    if (!pngData || !pngGenerating) return;
    const capture = async () => {
      try {
        await document.fonts.ready;
        await new Promise(r => requestAnimationFrame(r));
        await new Promise(r => setTimeout(r, 200));

        const html2canvas = (await import("html2canvas")).default;
        const el = document.getElementById("fixture-png-export-card");
        if (!el) { toast.error("Card element not found"); return; }

        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#0f172a",
          logging: false,
        });

        const sport = pngData.sport;
        const sportSlug = `${sport?.sport_name || ""}${sport?.gender ? `_${sport.gender}` : ""}`.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "");
        const leagueSlug = pngData.leagueName ? `_${pngData.leagueName}`.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_]/g, "") : "";
        const a = document.createElement("a");
        a.download = `Fixture_${sportSlug}${leagueSlug}_${new Date().toISOString().split("T")[0]}.png`;
        a.href = canvas.toDataURL("image/png", 1.0);
        a.click();
        toast.success("PNG downloaded");
      } catch (err) {
        console.error(err);
        toast.error("Failed to generate PNG");
      } finally {
        setPngGenerating(false);
        setPngData(null);
      }
    };
    capture();
  }, [pngData]);

  const handleExportPNG = async () => {
    const { sportId, leagueName, status } = pngModal;
    if (!sportId) { toast.error("Select a sport first"); return; }
    const sport = sports.find(s => s.id === sportId);
    let items = matches.filter(m => m.sport_id === sportId);
    if (leagueName) items = items.filter(m => m.league_name === leagueName);
    if (status)     items = items.filter(m => m.status === status);
    items = items.sort((a, b) => `${a.match_date} ${a.match_time}`.localeCompare(`${b.match_date} ${b.match_time}`));
    if (!items.length) { toast.error("No matches found for this selection"); return; }

    // Large cards crash the browser — html2canvas at 2× scale needs ~3 MB per 10 rows.
    // Hard-cap at 80; combine league + status filters to reduce the count.
    if (items.length > 80) {
      toast.error(`PNG is limited to 80 matches (${items.length} selected). Use the League and/or Status filters to narrow the selection, or use PDF / Excel for large exports.`);
      return;
    }

    let allEvents = [], allCards = [];
    try {
      [allEvents, allCards] = await Promise.all([
        MatchEventsAPI.getByEvent(eventId),
        DisciplinaryAPI.getByEvent(eventId),
      ]);
    } catch {}
    const evMap = {};
    allEvents.forEach(ev => { (evMap[ev.match_id] = evMap[ev.match_id] || []).push(ev); });
    const cMap = {};
    allCards.forEach(c => { (cMap[c.match_id] = cMap[c.match_id] || []).push(c); });

    // Close modal BEFORE starting capture so the page never goes blank.
    setPngModal({ open: false, sportId: "", leagueName: "", status: "" });
    toast.info("Preparing PNG image…");
    setPngGenerating(true);
    setPngData({ sport, leagueName, items, eventsMap: evMap, cardsMap: cMap });
  };

  // Close export menu on outside click
  useEffect(() => {
    if (!exportMenuOpen) return;
    const handler = (e) => { if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) setExportMenuOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [exportMenuOpen]);

  const quickUpdateScore = async (match, aScore, bScore, newStatus) => {
    if (disabled) return;
    try {
      const payload = { ...match, team_a_score: aScore, team_b_score: bScore };
      if (newStatus) payload.status = newStatus;
      
      const saved = await LiveScoresAPI.saveMatch(payload);
      setMatches(prev => prev.map(m => m.id === saved.id ? saved : m));
      toast.success("Status updated");
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  const handleIncrementScore = async (matchId, field) => {
    if (disabled) return;
    try {
      let updatedMatch;
      setMatches(prev => {
        const match = prev.find(m => m.id === matchId);
        if (!match) return prev;
        const currentVal = parseInt(match[field]) || 0;
        updatedMatch = { ...match, [field]: (currentVal + 1).toString() };
        return prev.map(m => m.id === matchId ? updatedMatch : m);
      });
      
      if (updatedMatch) {
        await LiveScoresAPI.saveMatch(updatedMatch);
      }
    } catch (err) {
      toast.error("Failed to update score");
    }
  };

  // Scores can only be edited while a match is actually in play. Once it's
  // Finished, an admin must "Reopen" it (or use Edit Match) to change scores.
  const canEditScore = (match) => !disabled && (match.status === "Live" || match.status === "Half Time / Break");

  const handleReopenMatch = (match) => {
    quickUpdateScore(match, match.team_a_score, match.team_b_score, "Live");
  };

  const setFilter = (setter) => (value) => {
    setter(value);
    setQuickView(null);
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const applyQuickView = (view) => {
    setQuickView(view);
    setFilterSportId("all");
    setFilterTeamId("all");
    setFilterSearch("");
    if (view === "today") {
      setFilterStatus("Upcoming");
      setFilterDate(todayStr);
    } else if (view === "recent") {
      setFilterStatus("Finished");
      setFilterDate("");
    } else {
      // "live" and "all" both clear status/date; "live" is handled separately below
      setFilterStatus("all");
      setFilterDate("");
    }
  };

  const clearFilters = () => {
    setFilterSportId("all");
    setFilterStatus("all");
    setFilterDate("");
    setFilterTeamId("all");
    setFilterSearch("");
    setQuickView("all");
  };

  const teamsById = useMemo(() => {
    const map = {};
    teams.forEach(t => { map[t.id] = t; });
    return map;
  }, [teams]);

  const filteredMatches = useMemo(() => {
    let result = matches.filter(m => {
      if (filterSportId !== "all" && m.sport_id !== filterSportId) return false;
      if (quickView === "live") {
        if (m.status !== "Live" && m.status !== "Half Time / Break") return false;
      } else if (filterStatus !== "all" && m.status !== filterStatus) {
        return false;
      }
      if (filterDate && m.match_date !== filterDate) return false;
      if (filterTeamId !== "all" && m.team_a_id !== filterTeamId && m.team_b_id !== filterTeamId) return false;
      if (filterSearch.trim()) {
        const q = filterSearch.trim().toLowerCase();
        const haystack = [m.match_title, m.team_a_name, m.team_b_name, m.venue].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    if (quickView === "recent") {
      result = [...result].sort((a, b) => {
        const da = `${a.match_date || ""} ${a.match_time || ""}`;
        const db = `${b.match_date || ""} ${b.match_time || ""}`;
        return db.localeCompare(da);
      });
    }

    return result;
  }, [matches, filterSportId, filterStatus, filterDate, filterTeamId, filterSearch, quickView]);

  if (loading) return <div className="p-12 text-center animate-pulse text-slate-500">Loading Live Scores...</div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Settings Section */}
      <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">Live Scores Feature</h3>
          <p className="text-sm text-slate-400">Enable or disable the live scores tab on the public QR Profile.</p>
        </div>
        <div className="flex items-center gap-4">
          <label className={cn("flex items-center gap-3 group", isSettingsDisabled ? "cursor-not-allowed" : "cursor-pointer")}>
            <div className="relative">
              <input 
                type="checkbox" 
                checked={settings.live_scores_enabled}
                onChange={(e) => setSettings({...settings, live_scores_enabled: e.target.checked})}
                disabled={isSettingsDisabled}
                className="sr-only peer"
              />
              <div className={cn(
                "w-11 h-6 bg-slate-800 border border-white/10 rounded-full peer peer-checked:bg-emerald-500 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white peer-checked:after:bg-white",
                !isSettingsDisabled && "group-hover:border-white/20"
              )} />
            </div>
            <span className={cn("text-sm font-bold text-white uppercase tracking-widest", !isSettingsDisabled && "group-hover:text-emerald-400")}>
              {settings.live_scores_enabled ? "Enabled" : "Disabled"}
            </span>
          </label>
          <Button onClick={saveSettings} disabled={isSettingsDisabled} loading={saving} variant="primary" icon={Save}>
            Save Status
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Add Match Form */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Manage Sports */}
          <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6 space-y-4">
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Manage Sports</h4>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="New Sport Name"
                value={newSport.sport_name}
                onChange={e => setNewSport({ ...newSport, sport_name: e.target.value })}
                disabled={isSettingsDisabled}
                className="flex-1 bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
              />
              <select
                value={newSport.gender}
                onChange={e => setNewSport({ ...newSport, gender: e.target.value })}
                disabled={isSettingsDisabled}
                className="bg-slate-800 border border-white/10 rounded-lg px-2 py-2 text-white text-sm outline-none"
              >
                <option value="">No Gender</option>
                <option value="Men">Men</option>
                <option value="Women">Women</option>
                <option value="Mixed">Mixed</option>
              </select>
              <button
                type="button"
                onClick={handleAddSport}
                disabled={isSettingsDisabled || !newSport.sport_name.trim()}
                className="shrink-0 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg px-3 flex items-center justify-center transition-colors"
                title="Add Sport"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <select
              value={newSport.standings_type}
              onChange={e => setNewSport({ ...newSport, standings_type: e.target.value })}
              disabled={isSettingsDisabled}
              title="Standings Type - determines which standings columns and ranking rules apply to this sport"
              className="w-full bg-slate-800 border border-white/10 rounded-lg px-2 py-2 text-white text-sm outline-none"
            >
              {STANDINGS_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
              {sports.map(s => (
                <div key={s.id} className="flex items-center justify-between bg-slate-800/50 p-2 rounded-lg border border-white/5">
                  <div className="flex flex-col min-w-0 flex-1 mr-2">
                    <span className="text-white text-sm font-medium truncate">{s.sport_name}{s.gender ? ` (${s.gender})` : ""}</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest">{s.format || "Custom (Manual)"}</span>
                  </div>
                  <select
                    value={s.standings_type || ""}
                    onChange={e => handleUpdateStandingsType(s.id, e.target.value)}
                    disabled={isSettingsDisabled}
                    title="Standings Type"
                    className="shrink-0 bg-slate-900 border border-white/10 rounded-lg px-1.5 py-1 text-white text-[10px] outline-none max-w-[110px]"
                  >
                    {STANDINGS_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <div className="flex items-center gap-1 shrink-0">
                    {!isSettingsDisabled && (
                      <button
                        onClick={() => setGenerateFixturesSport(s)}
                        title="Generate Fixtures"
                        className="text-blue-400 hover:text-blue-300 p-1"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {!isSettingsDisabled && (
                      <button onClick={() => handleDeleteSport(s.id)} className="text-red-400 hover:text-red-300 p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {sports.length === 0 && <p className="text-xs text-slate-500">No sports added yet.</p>}
            </div>
          </div>

          {/* Manage Leagues */}
          {sports.length > 0 && !isSettingsDisabled && (
            <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6 space-y-4">
              <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Manage Leagues / Fixtures</h4>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Sport</label>
                <select
                  value={leagueManageSportId || sports.find(s => getLeaguesForSport(s.id).length > 0)?.id || sports[0]?.id || ""}
                  onChange={e => setLeagueManageSportId(e.target.value)}
                  className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                >
                  {sports.map(s => {
                    const lCount = getLeaguesForSport(s.id).length;
                    const noLeagueCount = matches.filter(m => m.sport_id === s.id && !m.league_name?.trim()).length;
                    const total = matches.filter(m => m.sport_id === s.id).length;
                    return <option key={s.id} value={s.id}>{s.sport_name}{s.gender ? ` (${s.gender})` : ""}{total > 0 ? ` — ${total} matches` : ""}</option>;
                  })}
                </select>
              </div>
              {(() => {
                const sid = leagueManageSportId || sports.find(s => getLeaguesForSport(s.id).length > 0)?.id || sports[0]?.id;
                const leagues = getLeaguesForSport(sid);
                const noLeagueCount = matches.filter(m => m.sport_id === sid && !m.league_name?.trim()).length;
                const totalCount = matches.filter(m => m.sport_id === sid).length;
                return (
                  <>
                    {leagues.length === 0 && noLeagueCount === 0 && (
                      <p className="text-xs text-slate-500">No matches yet for this sport.</p>
                    )}
                    {(leagues.length > 0 || noLeagueCount > 0) && (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {leagues.map(league => {
                          const count = matches.filter(m => m.sport_id === sid && m.league_name === league).length;
                          return (
                            <div key={league} className="flex items-center justify-between bg-slate-800/50 p-2.5 rounded-lg border border-white/5">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <Trophy className="w-3 h-3 text-amber-400 shrink-0" />
                                  <span className="text-white text-sm font-semibold truncate">{league}</span>
                                </div>
                                <span className="text-slate-500 text-[10px] pl-4">{count} match{count !== 1 ? 'es' : ''}</span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 ml-2">
                                <button
                                  onClick={() => setRenameLeagueModal({ open: true, sportId: sid, oldName: league, newName: league })}
                                  className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                                  title="Rename"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteLeague(sid, league)}
                                  className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                  title="Delete league & all its matches"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                        {noLeagueCount > 0 && (
                          <div className="flex items-center justify-between bg-slate-800/30 p-2.5 rounded-lg border border-dashed border-white/10">
                            <div className="min-w-0">
                              <span className="text-slate-400 text-sm font-semibold block">No League / Unassigned</span>
                              <span className="text-slate-500 text-[10px]">{noLeagueCount} match{noLeagueCount !== 1 ? 'es' : ''} with no fixture name</span>
                            </div>
                            <button
                              onClick={() => handleDeleteNoLeagueMatches(sid)}
                              className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors shrink-0 ml-2"
                              title="Delete all unassigned matches"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    {totalCount > 0 && (
                      <button
                        onClick={() => handleDeleteAllSportMatches(sid)}
                        className="w-full py-2 bg-red-900/20 hover:bg-red-900/40 border border-red-500/20 text-red-400 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete All {totalCount} Matches for This Sport
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* Add/Edit Match */}
          <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6 space-y-4">
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex justify-between">
              {editingMatch ? "Edit Match" : "Add New Match"}
              {editingMatch && <button onClick={resetMatchForm} className="text-blue-400 hover:underline text-xs">Cancel Edit</button>}
            </h4>

            {sports.length === 0 ? (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-200 text-sm">
                Please add at least one sport above before creating matches.
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Sport</label>
                  <select 
                    value={matchForm.sport_id}
                    onChange={e => setMatchForm({...matchForm, sport_id: e.target.value})}
                    disabled={isSettingsDisabled && !editingMatch}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                  >
                    <option value="">Select Sport...</option>
                    {sports.map(s => <option key={s.id} value={s.id}>{s.sport_name}{s.gender ? ` (${s.gender})` : ""}</option>)}
                  </select>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">League (Optional)</label>
                  <input
                    type="text"
                    list="match-form-leagues"
                    placeholder="e.g. Group A, Premier League"
                    value={matchForm.league_name}
                    onChange={e => setMatchForm({...matchForm, league_name: e.target.value})}
                    disabled={isSettingsDisabled && !editingMatch}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                  />
                  <datalist id="match-form-leagues">
                    {getLeaguesForSport(matchForm.sport_id).map(l => <option key={l} value={l} />)}
                  </datalist>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Match Title / Phase</label>
                  <input
                    type="text" placeholder="e.g. Final, Group Stage"
                    value={matchForm.match_title} onChange={e => setMatchForm({...matchForm, match_title: e.target.value})}
                    disabled={isSettingsDisabled && !editingMatch}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Team/Player A</label>
                    <select
                      value={matchForm.team_a_id}
                      onChange={e => {
                        const id = e.target.value;
                        const team = teams.find(t => t.id === id);
                        setMatchForm({...matchForm, team_a_id: id, team_a_name: team ? team.name : ""});
                      }}
                      disabled={isSettingsDisabled && !editingMatch}
                      className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none mb-1.5"
                    >
                      <option value="">Custom Name...</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    {!matchForm.team_a_id && (
                      <input
                        type="text" placeholder="Name"
                        value={matchForm.team_a_name} onChange={e => setMatchForm({...matchForm, team_a_name: e.target.value})}
                        disabled={isSettingsDisabled && !editingMatch}
                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                      />
                    )}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Team/Player B</label>
                    <select
                      value={matchForm.team_b_id}
                      onChange={e => {
                        const id = e.target.value;
                        const team = teams.find(t => t.id === id);
                        setMatchForm({...matchForm, team_b_id: id, team_b_name: team ? team.name : ""});
                      }}
                      disabled={isSettingsDisabled && !editingMatch}
                      className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none mb-1.5"
                    >
                      <option value="">Custom Name...</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                    {!matchForm.team_b_id && (
                      <input
                        type="text" placeholder="Name"
                        value={matchForm.team_b_name} onChange={e => setMatchForm({...matchForm, team_b_name: e.target.value})}
                        disabled={isSettingsDisabled && !editingMatch}
                        className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                      />
                    )}
                  </div>
                </div>

                {editingMatch && (() => {
                  const isVolleyball = sports.find(s => s.id === matchForm.sport_id)?.standings_type === "volleyball";
                  return (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-emerald-500 uppercase">{isVolleyball ? "Sets Won A" : "Score A"}</label>
                        <input
                          type="text"
                          value={matchForm.team_a_score} onChange={e => setMatchForm({...matchForm, team_a_score: e.target.value})}
                          disabled={disabled}
                          className="w-full bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-emerald-400 font-black text-center text-lg outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-emerald-500 uppercase">{isVolleyball ? "Sets Won B" : "Score B"}</label>
                        <input
                          type="text"
                          value={matchForm.team_b_score} onChange={e => setMatchForm({...matchForm, team_b_score: e.target.value})}
                          disabled={disabled}
                          className="w-full bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-emerald-400 font-black text-center text-lg outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Date</label>
                    <input 
                      type="date" 
                      value={matchForm.match_date} onChange={e => setMatchForm({...matchForm, match_date: e.target.value})}
                      disabled={isSettingsDisabled && !editingMatch}
                      className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Time</label>
                    <input 
                      type="time" 
                      value={matchForm.match_time} onChange={e => setMatchForm({...matchForm, match_time: e.target.value})}
                      disabled={isSettingsDisabled && !editingMatch}
                      className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Venue</label>
                  <input 
                    type="text" placeholder="Court 1, Main Pool, etc."
                    value={matchForm.venue} onChange={e => setMatchForm({...matchForm, venue: e.target.value})}
                    disabled={isSettingsDisabled && !editingMatch}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Status</label>
                  <select 
                    value={matchForm.status} onChange={e => setMatchForm({...matchForm, status: e.target.value})}
                    disabled={disabled}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none font-bold"
                  >
                    {STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>

                <div className="flex gap-3 mt-4">
                  <Button onClick={handleSaveMatch} disabled={disabled} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white">
                    <Save className="w-4 h-4 mr-2" /> {editingMatch ? "Update Match" : "Create Match"}
                  </Button>
                  {editingMatch && (
                    <button onClick={resetMatchForm} disabled={disabled} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center">
                      <XCircle className="w-4 h-4 mr-2" /> Cancel Edit
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Right Column: Matches List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <h3 className="text-lg font-bold text-white">Live & Upcoming Matches</h3>
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                {filteredMatches.length === matches.length ? `${matches.length} Matches Total` : `${filteredMatches.length} of ${matches.length} Matches`}
              </span>
              {matches.length > 0 && (
                <div className="relative" ref={exportMenuRef}>
                  <button
                    onClick={() => setExportMenuOpen(prev => !prev)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-300 hover:text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" /> Export <ChevronDown className="w-3 h-3" />
                  </button>
                  {exportMenuOpen && (
                    <div className="absolute right-0 top-full mt-1.5 z-30 bg-slate-900 border border-white/10 rounded-xl shadow-2xl p-2 min-w-[210px] space-y-0.5">
                      <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-2 py-1">All Matches</p>
                      <button onClick={() => { handleExportFixtures(true); setExportMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800 rounded-lg text-sm text-slate-200 transition-colors text-left">
                        <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> <span>Excel (.xlsx)</span>
                      </button>
                      <button onClick={() => { handleExportPDF(true); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800 rounded-lg text-sm text-slate-200 transition-colors text-left">
                        <FileText className="w-3.5 h-3.5 text-red-400 shrink-0" /> <span>PDF Schedule</span>
                      </button>
                      <button onClick={() => { setPngModal({ open: true, sportId: sports[0]?.id || "", leagueName: "", status: "" }); setExportMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800 rounded-lg text-sm text-slate-200 transition-colors text-left">
                        <Image className="w-3.5 h-3.5 text-blue-400 shrink-0" /> <span>PNG / Social Media</span>
                      </button>
                      <div className="h-px bg-white/5 my-1" />
                      <button onClick={() => { handleExportPlayerStats(); setExportMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800 rounded-lg text-sm text-slate-200 transition-colors text-left">
                        <Download className="w-3.5 h-3.5 text-cyan-400 shrink-0" /> <span>Player Stats (.xlsx)</span>
                      </button>
                      {filteredMatches.length !== matches.length && (
                        <>
                          <div className="h-px bg-white/5 my-1" />
                          <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-2 py-1">Filtered View ({filteredMatches.length})</p>
                          <button onClick={() => { handleExportFixtures(false); setExportMenuOpen(false); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800 rounded-lg text-sm text-slate-200 transition-colors text-left">
                            <Download className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> <span>Excel (filtered)</span>
                          </button>
                          <button onClick={() => { handleExportPDF(false); }} className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800 rounded-lg text-sm text-slate-200 transition-colors text-left">
                            <FileText className="w-3.5 h-3.5 text-red-400 shrink-0" /> <span>PDF (filtered)</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Quick Views */}
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { id: "all", label: "All Matches" },
              { id: "live", label: "Live Now" },
              { id: "today", label: "Upcoming Today" },
              { id: "recent", label: "Recently Completed" },
            ].map(qv => (
              <button
                key={qv.id}
                onClick={() => applyQuickView(qv.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border",
                  quickView === qv.id
                    ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
                    : "bg-slate-800/50 border-white/10 text-slate-400 hover:text-white"
                )}
              >
                {qv.label}
              </button>
            ))}
          </div>

          {/* Individual / Heat Sheet sports - no team matches, managed elsewhere */}
          {sports.some(s => s.format === "Individual") && (
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-indigo-200">
                <Info className="w-4 h-4 shrink-0" />
                <h4 className="text-xs font-bold uppercase tracking-widest">Individual / Heat Sheet Sports</h4>
              </div>
              <p className="text-xs text-indigo-200/70">
                These sports use the Individual format - no team-vs-team matches. Manage their event schedules and heat sheets/results in the Sport Events &amp; Heat Sheets tab.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {sports.filter(s => s.format === "Individual").map(s => (
                  <span key={s.id} className="px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-xs text-indigo-100">
                    {s.sport_name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-4 flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-2 min-w-[140px]">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sport</label>
              <select
                value={filterSportId}
                onChange={e => setFilter(setFilterSportId)(e.target.value)}
                className="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
              >
                <option value="all">All Sports</option>
                {sports.map(s => <option key={s.id} value={s.id}>{s.sport_name}{s.gender ? ` (${s.gender})` : ""}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2 min-w-[140px]">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status</label>
              <select
                value={filterStatus}
                onChange={e => setFilter(setFilterStatus)(e.target.value)}
                className="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
              >
                <option value="all">All Statuses</option>
                {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2 min-w-[140px]">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</label>
              <input
                type="date"
                value={filterDate}
                onChange={e => setFilter(setFilterDate)(e.target.value)}
                className="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
              />
            </div>
            <div className="flex flex-col gap-2 min-w-[140px]">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Team</label>
              <select
                value={filterTeamId}
                onChange={e => setFilter(setFilterTeamId)(e.target.value)}
                className="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
              >
                <option value="all">All Teams</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[220px] flex flex-col gap-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Match, team, or venue..."
                  value={filterSearch}
                  onChange={e => setFilter(setFilterSearch)(e.target.value)}
                  className="w-full bg-slate-800 border border-white/10 rounded-lg pl-10 pr-3 py-2 text-white text-sm outline-none"
                />
              </div>
            </div>
            <button onClick={clearFilters} className="px-3 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold uppercase transition-colors">
              Clear Filters
            </button>
          </div>

          <div className="space-y-3">
            {matches.length === 0 ? (
              <div className="border border-dashed border-white/10 rounded-2xl p-12 text-center">
                <p className="text-slate-400 font-medium">No matches created yet.</p>
              </div>
            ) : filteredMatches.length === 0 ? (
              <div className="border border-dashed border-white/10 rounded-2xl p-12 text-center">
                <p className="text-slate-400 font-medium">No matches match the current filters.</p>
              </div>
            ) : (
              sports.map(sport => {
                const sportMatches = filteredMatches.filter(m => m.sport_id === sport.id);
                if (sportMatches.length === 0) return null;
                
                const isCollapsed = collapsedSports[sport.id];
                
                return (
                  <div key={sport.id} className="space-y-3 bg-slate-900/40 border border-white/5 rounded-2xl p-4">
                    <button 
                      onClick={() => setCollapsedSports(prev => ({...prev, [sport.id]: !prev[sport.id]}))}
                      className="w-full flex items-center justify-between group"
                    >
                      <h3 className="text-sm font-black text-white uppercase tracking-widest group-hover:text-emerald-400 transition-colors flex items-center gap-2">
                        {sport.sport_name}{sport.gender ? ` (${sport.gender})` : ""}
                        <span className="bg-white/10 text-white/50 px-2 py-0.5 rounded-full text-[10px]">{sportMatches.length} Matches</span>
                      </h3>
                      <div className="p-1 rounded-md bg-white/5 group-hover:bg-white/10 transition-colors">
                        {isCollapsed ? <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-emerald-400" /> : <ChevronUp className="w-4 h-4 text-slate-400 group-hover:text-emerald-400" />}
                      </div>
                    </button>
                    
                    <AnimatePresence>
                      {!isCollapsed && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-3 pt-3 mt-3 border-t border-white/5">
                            {(() => {
                              const sportLeagues = getLeaguesForSport(sport.id).filter(l => sportMatches.some(m => m.league_name === l));
                              const leagueless = sportMatches.filter(m => !m.league_name?.trim());
                              const groups = [
                                ...sportLeagues.map(l => ({ label: l, items: sportMatches.filter(m => m.league_name === l) })),
                                ...(leagueless.length > 0 ? [{ label: null, items: leagueless }] : [])
                              ];
                              return groups.map(({ label, items }) => (
                                <div key={label || '__none__'}>
                                  {label && (
                                    <div className="flex items-center gap-2 mb-2 px-1">
                                      <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                      <span className="text-xs font-black text-amber-400 uppercase tracking-wider">{label}</span>
                                      <span className="text-[10px] text-slate-600">· {items.length} match{items.length !== 1 ? 'es' : ''}</span>
                                    </div>
                                  )}
                                  <div className="space-y-3">
                                  {items.map(match => (
                              <div key={match.id} className="bg-slate-900/80 border border-white/10 rounded-xl p-4 hover:border-white/20 transition-all flex flex-col sm:flex-row gap-4 items-center">
                                
                                {/* Left Info */}
                                <div className="flex-1 w-full">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={cn(
                                      "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider",
                                      match.status === "Live" ? "bg-red-500 text-white animate-pulse" :
                                      match.status === "Finished" ? "bg-slate-700 text-slate-300" :
                                      match.status === "Cancelled" ? "bg-red-900/50 text-red-400" :
                                      match.status === "Postponed" ? "bg-amber-900/50 text-amber-400" :
                                      "bg-blue-500/20 text-blue-400"
                                    )}>
                                      {match.status}
                                    </span>
                                    <span className="text-xs font-medium text-slate-400">{match.match_title}</span>
                                  </div>
                                  
                                  <div className="flex items-center justify-between sm:justify-start gap-4 mb-2">
                                    <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
                                      <TeamBadge
                                        logoUrl={teamsById[match.team_a_id]?.logo_url}
                                        country={teamsById[match.team_a_id]?.country}
                                        name={match.team_a_name}
                                        size="md"
                                      />
                                      <p className="text-white font-bold truncate">{match.team_a_name || 'TBA'}</p>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-1 bg-black/40 rounded-lg border border-white/5 shrink-0">
                                      <button
                                        onClick={() => handleIncrementScore(match.id, 'team_a_score')}
                                        disabled={!canEditScore(match)}
                                        title={canEditScore(match) ? "Add point" : "Score is locked. Set match to Live (or Reopen) to edit."}
                                        className="w-7 h-7 flex items-center justify-center bg-emerald-500/10 hover:bg-emerald-500/30 text-emerald-400 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-emerald-500/10"
                                      >
                                        <Plus className="w-3 h-3" />
                                      </button>
                                      <span className="w-8 text-center text-xl font-black text-emerald-400">{match.team_a_score}</span>
                                      <span className="text-xs text-slate-600">-</span>
                                      <span className="w-8 text-center text-xl font-black text-emerald-400">{match.team_b_score}</span>
                                      <button
                                        onClick={() => handleIncrementScore(match.id, 'team_b_score')}
                                        disabled={!canEditScore(match)}
                                        title={canEditScore(match) ? "Add point" : "Score is locked. Set match to Live (or Reopen) to edit."}
                                        className="w-7 h-7 flex items-center justify-center bg-emerald-500/10 hover:bg-emerald-500/30 text-emerald-400 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-emerald-500/10"
                                      >
                                        <Plus className="w-3 h-3" />
                                      </button>
                                    </div>
                                    <div className="flex-1 flex items-center gap-2 min-w-0">
                                      <TeamBadge
                                        logoUrl={teamsById[match.team_b_id]?.logo_url}
                                        country={teamsById[match.team_b_id]?.country}
                                        name={match.team_b_name}
                                        size="md"
                                      />
                                      <p className="text-white font-bold truncate">{match.team_b_name || 'TBA'}</p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {match.match_date}</span>
                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {match.match_time}</span>
                                    <span>{match.venue}</span>
                                  </div>

                                  <MatchEventsPanel match={match} sportName={sport.sport_name} standingsType={sport.standings_type} disabled={disabled} />
                                </div>

                                {/* Quick Actions */}
                                {!disabled && (
                                  <div className="flex sm:flex-col gap-2 shrink-0 border-t sm:border-t-0 sm:border-l border-white/10 pt-3 sm:pt-0 sm:pl-4 w-full sm:w-auto justify-end">
                                    <button onClick={() => editMatch(match)} className="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-xs font-bold transition-colors">
                                      Edit Match
                                    </button>
                                    {match.status === "Upcoming" && (
                                      <button onClick={() => quickUpdateScore(match, match.team_a_score, match.team_b_score, "Live")} className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-bold transition-colors">
                                        Start Live
                                      </button>
                                    )}
                                    {(match.status === "Live" || match.status === "Half Time / Break") && (
                                      <button onClick={() => quickUpdateScore(match, match.team_a_score, match.team_b_score, "Finished")} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition-colors">
                                        Finish
                                      </button>
                                    )}
                                    {match.status === "Finished" && (
                                      <button onClick={() => handleReopenMatch(match)} className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5">
                                        <RotateCcw className="w-3 h-3" /> Reopen Match
                                      </button>
                                    )}
                                    {!isSettingsDisabled && (
                                      <button onClick={() => handleDeleteMatch(match.id)} className="px-3 py-1.5 bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded-lg text-xs font-bold transition-colors">
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                                  </div>
                                </div>
                              ));
                            })()}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })
            )}
          </div>

        </div>
      </div>

      {/* Standings Section */}
      {sports.length > 0 && (() => {
        const selectedStandingsType = sports.find(s => s.id === standingsSportId)?.standings_type || "";
        const standingsColumns = getStandingsColumns(selectedStandingsType);
        return (
        <div className="bg-slate-900/50 border border-white/10 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" /> League Standings
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={standingsSportId}
                onChange={e => setStandingsSportId(e.target.value)}
                className="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
              >
                {sports.map(s => <option key={s.id} value={s.id}>{s.sport_name}{s.gender ? ` (${s.gender})` : ""}</option>)}
              </select>
              {divisions.length > 0 && (
                <select
                  value={standingsDivisionId}
                  onChange={e => setStandingsDivisionId(e.target.value)}
                  className="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                >
                  <option value="all">All Divisions</option>
                  {divisions.map(d => <option key={d.id} value={d.id}>{d.name}{d.gender ? ` (${d.gender})` : ""}</option>)}
                </select>
              )}
              {!isSettingsDisabled && (
                <button
                  onClick={() => setShowDivisionSettings(prev => !prev)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold uppercase transition-colors flex items-center gap-1.5"
                >
                  {showDivisionSettings ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  Divisions &amp; Points
                </button>
              )}
            </div>
          </div>

          {/* Divisions & Points configuration panel */}
          {!isSettingsDisabled && (
            <AnimatePresence>
              {showDivisionSettings && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="bg-slate-950/50 border border-white/10 rounded-xl p-4 space-y-5">
                    {/* Points System - only meaningful for the Football/Default standings type.
                        Basketball ranks by win%, Volleyball uses fixed FIVB match-point scoring. */}
                    {(!selectedStandingsType || selectedStandingsType === "football") ? (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Points System</h4>
                        <div className="flex items-end gap-3 flex-wrap">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Win</label>
                            <input type="number" value={pointsConfig.points_win} onChange={e => setPointsConfig(prev => ({ ...prev, points_win: e.target.value }))} className="w-20 bg-slate-800 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm outline-none" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Draw</label>
                            <input type="number" value={pointsConfig.points_draw} onChange={e => setPointsConfig(prev => ({ ...prev, points_draw: e.target.value }))} className="w-20 bg-slate-800 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm outline-none" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Loss</label>
                            <input type="number" value={pointsConfig.points_loss} onChange={e => setPointsConfig(prev => ({ ...prev, points_loss: e.target.value }))} className="w-20 bg-slate-800 border border-white/10 rounded-lg px-2 py-1.5 text-white text-sm outline-none" />
                          </div>
                          <Button onClick={handleSavePoints} loading={savingPoints} variant="primary" icon={Save}>
                            Save
                          </Button>
                        </div>
                        <p className="text-[11px] text-slate-500">Applies to standings for this sport only. Defaults to 3 / 1 / 0 if unset.</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Points System</h4>
                        <p className="text-[11px] text-slate-500">
                          {selectedStandingsType === "basketball"
                            ? "Basketball standings rank by Win% then point differential - no points config needed."
                            : "Volleyball standings use fixed FIVB match-point scoring (3/2/1/0 by set margin) - no points config needed."}
                        </p>
                      </div>
                    )}

                    {/* Divisions */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Divisions</h4>
                      {divisions.length > 0 && (
                        <div className="space-y-1.5">
                          {divisions.map(d => (
                            <div key={d.id} className="flex items-center justify-between bg-slate-800/50 p-2 rounded-lg border border-white/5">
                              <span className="text-white text-sm font-medium">{d.name}{d.gender ? <span className="text-slate-500"> · {d.gender}</span> : ""}</span>
                              <button onClick={() => handleDeleteDivision(d.id)} className="text-red-400 hover:text-red-300 p-1">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        <input
                          type="text"
                          placeholder="New Division Name (e.g. Men's Division A)"
                          value={newDivisionName}
                          onChange={e => setNewDivisionName(e.target.value)}
                          className="flex-1 min-w-[200px] bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                        />
                        <select
                          value={newDivisionGender}
                          onChange={e => setNewDivisionGender(e.target.value)}
                          className="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                        >
                          <option value="">No Gender</option>
                          <option value="Men">Men</option>
                          <option value="Women">Women</option>
                          <option value="Mixed">Mixed</option>
                        </select>
                        <Button onClick={handleAddDivision} className="bg-blue-600 hover:bg-blue-500 text-white px-3">
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Team Division Assignments */}
                    {divisions.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Team Assignments</h4>
                        {Object.keys(teamDivisions).length === 0 ? (
                          <p className="text-xs text-slate-500">No teams registered for this sport yet.</p>
                        ) : (
                          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-2">
                            {Object.keys(teamDivisions).map(teamId => (
                              <div key={teamId} className="flex items-center justify-between gap-2 bg-slate-800/50 p-2 rounded-lg border border-white/5">
                                <span className="text-white text-sm font-medium truncate">{teamsById[teamId]?.name || "Unknown Team"}</span>
                                <select
                                  value={teamDivisions[teamId] || ""}
                                  onChange={e => handleTeamDivisionChange(teamId, e.target.value)}
                                  className="bg-slate-800 border border-white/10 rounded-lg px-2 py-1 text-white text-xs outline-none"
                                >
                                  <option value="">Unassigned</option>
                                  {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                </select>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}

          {standingsLoading ? (
            <p className="text-slate-400 text-sm">Loading standings...</p>
          ) : standings.length === 0 ? (
            <p className="text-slate-400 text-sm">
              No teams registered for this sport yet, or no matches between linked teams have been marked Finished.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-slate-500 text-xs uppercase tracking-widest">
                    <th className="py-2 pr-4">#</th>
                    <th className="py-2 pr-4">Team</th>
                    {standingsColumns.map(col => (
                      <th key={col.key} className="py-2 pr-3 text-center" title={col.title}>{col.header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {standings.map((row, i) => (
                    <tr key={row.team_id} className="text-white">
                      <td className="py-2 pr-4 text-slate-500">{i + 1}</td>
                      <td className="py-2 pr-4 font-bold">{row.team_name}</td>
                      {standingsColumns.map(col => (
                        <td key={col.key} className={cn("py-2 pr-3 text-center", col.highlight && "font-black text-amber-400")}>
                          {col.format ? col.format(row[col.key]) : row[col.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px] text-slate-500 leading-relaxed mt-2">
                {getStandingsLegend(selectedStandingsType)}
              </p>
            </div>
          )}
        </div>
        );
      })()}

      {/* Rename League Modal */}
      {renameLeagueModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-white">Rename League</h3>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">New League Name</label>
              <input
                type="text"
                value={renameLeagueModal.newName}
                onChange={e => setRenameLeagueModal(prev => ({ ...prev, newName: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleRenameLeague()}
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-blue-500"
                autoFocus
              />
            </div>
            <p className="text-xs text-slate-500">All matches in "{renameLeagueModal.oldName}" will be updated to the new name.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setRenameLeagueModal({ open: false, sportId: null, oldName: "", newName: "" })}
                disabled={renamingLeague}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameLeague}
                disabled={renamingLeague || !renameLeagueModal.newName.trim()}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-sm font-bold transition-colors"
              >
                {renamingLeague ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PNG Export Modal ──────────────────────────────────────────────── */}
      {pngModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-white">Export PNG — Social Media Card</h3>
              <p className="text-xs text-slate-500 mt-1">Generates a styled fixture card (920 px wide, 2× resolution) ready to share. Max 80 matches.</p>
            </div>

            {/* Sport */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Sport</label>
              <select
                value={pngModal.sportId}
                onChange={e => setPngModal(prev => ({ ...prev, sportId: e.target.value, leagueName: "", status: "" }))}
                className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
              >
                <option value="">Select sport…</option>
                {sports.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.sport_name}{s.gender ? ` (${s.gender})` : ""} — {matches.filter(m => m.sport_id === s.id).length} matches
                  </option>
                ))}
              </select>
            </div>

            {pngModal.sportId && (
              <>
                {/* League */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">League / Fixture</label>
                  <select
                    value={pngModal.leagueName}
                    onChange={e => setPngModal(prev => ({ ...prev, leagueName: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                  >
                    <option value="">All leagues</option>
                    {getLeaguesForSport(pngModal.sportId).map(l => {
                      const count = matches.filter(m => m.sport_id === pngModal.sportId && m.league_name === l && (!pngModal.status || m.status === pngModal.status)).length;
                      return <option key={l} value={l}>{l} — {count} matches</option>;
                    })}
                  </select>
                </div>

                {/* Status */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Status Filter</label>
                  <select
                    value={pngModal.status}
                    onChange={e => setPngModal(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                  >
                    <option value="">All statuses</option>
                    {STATUS_OPTIONS.map(s => {
                      const count = matches.filter(m =>
                        m.sport_id === pngModal.sportId &&
                        (!pngModal.leagueName || m.league_name === pngModal.leagueName) &&
                        m.status === s
                      ).length;
                      return count > 0
                        ? <option key={s} value={s}>{s} — {count} matches</option>
                        : null;
                    })}
                  </select>
                </div>

                {/* Live count preview */}
                {(() => {
                  const count = matches.filter(m =>
                    m.sport_id === pngModal.sportId &&
                    (!pngModal.leagueName || m.league_name === pngModal.leagueName) &&
                    (!pngModal.status   || m.status     === pngModal.status)
                  ).length;
                  const over = count > 80;
                  return (
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold ${over ? "bg-red-500/10 border border-red-500/20 text-red-300" : "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"}`}>
                      <span>{count} match{count !== 1 ? "es" : ""} selected</span>
                      {over && <span className="ml-auto text-red-400">↑ over 80 limit — add filters</span>}
                    </div>
                  );
                })()}
              </>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setPngModal({ open: false, sportId: "", leagueName: "", status: "" })}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-bold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleExportPNG}
                disabled={pngGenerating || !pngModal.sportId}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
              >
                <Image className="w-4 h-4" />
                {pngGenerating ? "Generating…" : "Download PNG"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden fixture card rendered off-screen for html2canvas capture */}
      {pngData && (
        <div style={{ position: "fixed", left: -9999, top: 0, zIndex: -1, pointerEvents: "none" }}>
          <FixturePNGCard
            sport={pngData.sport}
            leagueName={pngData.leagueName}
            items={pngData.items}
            eventsMap={pngData.eventsMap}
            cardsMap={pngData.cardsMap}
          />
        </div>
      )}

      <GenerateFixturesModal
        isOpen={!!generateFixturesSport}
        onClose={() => setGenerateFixturesSport(null)}
        sport={generateFixturesSport}
        eventId={eventId}
        teams={teams}
        divisions={generateFixturesSport && generateFixturesSport.id === standingsSportId ? divisions : []}
        teamDivisions={generateFixturesSport && generateFixturesSport.id === standingsSportId ? teamDivisions : {}}
        existingLeagues={generateFixturesSport ? getLeaguesForSport(generateFixturesSport.id) : []}
        existingSportMatchCount={generateFixturesSport ? matches.filter(m => m.sport_id === generateFixturesSport.id).length : 0}
        onGenerated={handleFixturesGenerated}
      />
    </div>
  );
}
