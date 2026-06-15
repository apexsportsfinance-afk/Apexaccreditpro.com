import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Save, Calendar, Clock, Edit2, Play, CheckCircle, XCircle, ChevronDown, ChevronUp, Trophy, Search, RotateCcw, Wand2, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LiveScoresAPI, DivisionsAPI } from "../../lib/storage";
import { TeamAPI } from "../../services/teamApi";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import TeamBadge from "../ui/TeamBadge";
import MatchEventsPanel from "./MatchEventsPanel";
import GenerateFixturesModal from "./GenerateFixturesModal";
import { useAuth } from "../../contexts/AuthContext";

export default function LiveScoresTab({ eventId, onToast, disabled }) {
  const { role } = useAuth();
  // If the user's role is "Score Operator", they can only update scores and status.
  const isScoreOperator = role === "Score Operator";
  // The user cannot edit settings/delete if they are generally disabled OR a score operator.
  const isSettingsDisabled = disabled || isScoreOperator;

  const [settings, setSettings] = useState({ event_id: eventId, live_scores_enabled: false });
  const [sports, setSports] = useState([]);
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [collapsedSports, setCollapsedSports] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [newSport, setNewSport] = useState({ sport_name: "", gender: "" });
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

  const [matchForm, setMatchForm] = useState({
    sport_id: "",
    match_title: "",
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
      const added = await LiveScoresAPI.saveSport({ event_id: eventId, sport_name: newSport.sport_name.trim(), gender: newSport.gender || null });
      setSports([...sports, added]);
      setNewSport({ sport_name: "", gender: "" });
      toast.success("Sport added");
    } catch (err) {
      toast.error("Failed to add sport");
    }
  };

  // Phase 4: called after the Generate Fixtures modal creates new matches
  // and/or saves the sport's chosen format. Additive only - never removes
  // existing matches.
  const handleFixturesGenerated = (insertedMatches, updatedSport) => {
    if (insertedMatches && insertedMatches.length > 0) {
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
      const payload = { ...matchForm, event_id: eventId, team_a_id: matchForm.team_a_id || null, team_b_id: matchForm.team_b_id || null };
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
            <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
              {sports.map(s => (
                <div key={s.id} className="flex items-center justify-between bg-slate-800/50 p-2 rounded-lg border border-white/5">
                  <div className="flex flex-col min-w-0">
                    <span className="text-white text-sm font-medium truncate">{s.sport_name}{s.gender ? ` (${s.gender})` : ""}</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest">{s.format || "Custom (Manual)"}</span>
                  </div>
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

                {editingMatch && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-emerald-500 uppercase">Score A</label>
                      <input 
                        type="text" 
                        value={matchForm.team_a_score} onChange={e => setMatchForm({...matchForm, team_a_score: e.target.value})}
                        disabled={disabled}
                        className="w-full bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-emerald-400 font-black text-center text-lg outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-emerald-500 uppercase">Score B</label>
                      <input 
                        type="text" 
                        value={matchForm.team_b_score} onChange={e => setMatchForm({...matchForm, team_b_score: e.target.value})}
                        disabled={disabled}
                        className="w-full bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-emerald-400 font-black text-center text-lg outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                )}

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
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-white">Live & Upcoming Matches</h3>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
              {filteredMatches.length === matches.length ? `${matches.length} Matches Total` : `${filteredMatches.length} of ${matches.length} Matches`}
            </span>
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
                            {sportMatches.map(match => (
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

                                  <MatchEventsPanel match={match} sportName={sport.sport_name} disabled={disabled} />
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
      {sports.length > 0 && (
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
                    {/* Points System */}
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
                    <th className="py-2 pr-3 text-center" title="Played">P</th>
                    <th className="py-2 pr-3 text-center" title="Won">W</th>
                    <th className="py-2 pr-3 text-center" title="Drawn">D</th>
                    <th className="py-2 pr-3 text-center" title="Lost">L</th>
                    <th className="py-2 pr-3 text-center" title="Goals/Points For">GF</th>
                    <th className="py-2 pr-3 text-center" title="Goals/Points Against">GA</th>
                    <th className="py-2 pr-3 text-center" title="Goal/Point Difference">GD</th>
                    <th className="py-2 pr-3 text-center" title="Total Points">Pts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {standings.map((row, i) => (
                    <tr key={row.team_id} className="text-white">
                      <td className="py-2 pr-4 text-slate-500">{i + 1}</td>
                      <td className="py-2 pr-4 font-bold">{row.team_name}</td>
                      <td className="py-2 pr-3 text-center">{row.played}</td>
                      <td className="py-2 pr-3 text-center">{row.won}</td>
                      <td className="py-2 pr-3 text-center">{row.drawn}</td>
                      <td className="py-2 pr-3 text-center">{row.lost}</td>
                      <td className="py-2 pr-3 text-center">{row.goals_for}</td>
                      <td className="py-2 pr-3 text-center">{row.goals_against}</td>
                      <td className="py-2 pr-3 text-center">{row.goal_diff}</td>
                      <td className="py-2 pr-3 text-center font-black text-amber-400">{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[11px] text-slate-500 leading-relaxed mt-2">
                P = Played · W = Won · D = Drawn · L = Lost · GF = Goals/Points For · GA = Goals/Points Against · GD = Goal/Point Difference · Pts = Total Points
              </p>
            </div>
          )}
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
        onGenerated={handleFixturesGenerated}
      />
    </div>
  );
}
