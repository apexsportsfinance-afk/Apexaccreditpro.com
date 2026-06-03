import React, { useState, useEffect } from "react";
import { Plus, Trash2, Save, Calendar, Clock, Edit2, Play, CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LiveScoresAPI } from "../../lib/storage";
import { toast } from "sonner";
import { cn } from "../../lib/utils";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
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
  const [collapsedSports, setCollapsedSports] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [newSport, setNewSport] = useState({ sport_name: "" });
  const [editingMatch, setEditingMatch] = useState(null);

  const [matchForm, setMatchForm] = useState({
    sport_id: "",
    match_title: "",
    team_a_name: "",
    team_b_name: "",
    team_a_score: "0",
    team_b_score: "0",
    match_date: new Date().toISOString().split('T')[0],
    match_time: "12:00",
    venue: "",
    status: "Upcoming",
    notes: ""
  });

  const STATUS_OPTIONS = ["Upcoming", "Live", "Half Time / Break", "Finished", "Cancelled"];

  useEffect(() => {
    loadData();
  }, [eventId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sData, spData, mData] = await Promise.all([
        LiveScoresAPI.getSettings(eventId),
        LiveScoresAPI.getSports(eventId),
        LiveScoresAPI.getMatches(eventId)
      ]);
      if (sData) setSettings(sData);
      if (spData) setSports(spData);
      if (mData) setMatches(mData);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load Live Scores data");
    } finally {
      setLoading(false);
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
      const added = await LiveScoresAPI.saveSport({ event_id: eventId, sport_name: newSport.sport_name.trim() });
      setSports([...sports, added]);
      setNewSport({ sport_name: "" });
      toast.success("Sport added");
    } catch (err) {
      toast.error("Failed to add sport");
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
      const payload = { ...matchForm, event_id: eventId };
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
      team_a_name: m.team_a_name || "",
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
      team_a_name: "",
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
                onChange={e => setNewSport({ sport_name: e.target.value })}
                disabled={isSettingsDisabled}
                className="flex-1 bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
              />
              <Button onClick={handleAddSport} disabled={isSettingsDisabled} className="bg-blue-600 hover:bg-blue-500 text-white p-2">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
              {sports.map(s => (
                <div key={s.id} className="flex items-center justify-between bg-slate-800/50 p-2 rounded-lg border border-white/5">
                  <span className="text-white text-sm font-medium">{s.sport_name}</span>
                  {!isSettingsDisabled && (
                    <button onClick={() => handleDeleteSport(s.id)} className="text-red-400 hover:text-red-300 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
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
                    {sports.map(s => <option key={s.id} value={s.id}>{s.sport_name}</option>)}
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
                    <input 
                      type="text" placeholder="Name"
                      value={matchForm.team_a_name} onChange={e => setMatchForm({...matchForm, team_a_name: e.target.value})}
                      disabled={isSettingsDisabled && !editingMatch}
                      className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Team/Player B</label>
                    <input 
                      type="text" placeholder="Name"
                      value={matchForm.team_b_name} onChange={e => setMatchForm({...matchForm, team_b_name: e.target.value})}
                      disabled={isSettingsDisabled && !editingMatch}
                      className="w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                    />
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
            <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{matches.length} Matches Total</span>
          </div>

          <div className="space-y-3">
            {matches.length === 0 ? (
              <div className="border border-dashed border-white/10 rounded-2xl p-12 text-center">
                <p className="text-slate-400 font-medium">No matches created yet.</p>
              </div>
            ) : (
              sports.map(sport => {
                const sportMatches = matches.filter(m => m.sport_id === sport.id);
                if (sportMatches.length === 0) return null;
                
                const isCollapsed = collapsedSports[sport.id];
                
                return (
                  <div key={sport.id} className="space-y-3 bg-slate-900/40 border border-white/5 rounded-2xl p-4">
                    <button 
                      onClick={() => setCollapsedSports(prev => ({...prev, [sport.id]: !prev[sport.id]}))}
                      className="w-full flex items-center justify-between group"
                    >
                      <h3 className="text-sm font-black text-white uppercase tracking-widest group-hover:text-emerald-400 transition-colors flex items-center gap-2">
                        {sport.sport_name}
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
                                      "bg-blue-500/20 text-blue-400"
                                    )}>
                                      {match.status}
                                    </span>
                                    <span className="text-xs font-medium text-slate-400">{match.match_title}</span>
                                  </div>
                                  
                                  <div className="flex items-center justify-between sm:justify-start gap-4 mb-2">
                                    <div className="flex-1 text-right sm:text-left">
                                      <p className="text-white font-bold">{match.team_a_name || 'TBA'}</p>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-1 bg-black/40 rounded-lg border border-white/5 shrink-0">
                                      <button 
                                        onClick={() => handleIncrementScore(match.id, 'team_a_score')} 
                                        disabled={disabled}
                                        className="w-7 h-7 flex items-center justify-center bg-emerald-500/10 hover:bg-emerald-500/30 text-emerald-400 rounded-md transition-colors"
                                      >
                                        <Plus className="w-3 h-3" />
                                      </button>
                                      <span className="w-8 text-center text-xl font-black text-emerald-400">{match.team_a_score}</span>
                                      <span className="text-xs text-slate-600">-</span>
                                      <span className="w-8 text-center text-xl font-black text-emerald-400">{match.team_b_score}</span>
                                      <button 
                                        onClick={() => handleIncrementScore(match.id, 'team_b_score')} 
                                        disabled={disabled}
                                        className="w-7 h-7 flex items-center justify-center bg-emerald-500/10 hover:bg-emerald-500/30 text-emerald-400 rounded-md transition-colors"
                                      >
                                        <Plus className="w-3 h-3" />
                                      </button>
                                    </div>
                                    <div className="flex-1 text-left">
                                      <p className="text-white font-bold">{match.team_b_name || 'TBA'}</p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {match.match_date}</span>
                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {match.match_time}</span>
                                    <span>{match.venue}</span>
                                  </div>
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
                                    {match.status === "Live" && (
                                      <button onClick={() => quickUpdateScore(match, match.team_a_score, match.team_b_score, "Finished")} className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-bold transition-colors">
                                        Finish
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
    </div>
  );
}
