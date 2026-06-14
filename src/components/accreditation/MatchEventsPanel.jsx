import React, { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2, Goal, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MatchEventsAPI, DisciplinaryAPI } from "../../lib/storage";
import { TeamAPI } from "../../services/teamApi";
import { toast } from "sonner";
import { cn } from "../../lib/utils";

const EVENT_TYPE_SUGGESTIONS = ["Goal", "Point", "Try", "Set Won", "Run", "Assist"];
const CARD_TYPES = ["Yellow", "Red"];

const emptyEventForm = { team_idx: "", team_id: "", team_name: "", player_accreditation_id: "", player_name: "", event_type: "Goal", minute: "", notes: "" };
const emptyCardForm = { team_idx: "", team_id: "", team_name: "", player_accreditation_id: "", player_name: "", card_type: "Yellow", reason: "", minute: "" };

// Expandable per-match panel for recording goal/point scorers (match_events)
// and yellow/red disciplinary cards (player_disciplinary_records). Loads its
// data lazily on first expand, and offers a roster dropdown (per team, via
// TeamAPI.getAdminTeamRoster) that pre-fills the free-text player name field.
export default function MatchEventsPanel({ match, sportName, disabled }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [events, setEvents] = useState([]);
  const [cards, setCards] = useState([]);
  const [rosters, setRosters] = useState({});

  const [eventForm, setEventForm] = useState(emptyEventForm);
  const [cardForm, setCardForm] = useState(emptyCardForm);
  const [savingEvent, setSavingEvent] = useState(false);
  const [savingCard, setSavingCard] = useState(false);

  const matchTeams = [
    { id: match.team_a_id || null, name: match.team_a_name },
    { id: match.team_b_id || null, name: match.team_b_name },
  ].filter(t => t.name);

  const toggleExpand = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !loaded) {
      setLoading(true);
      try {
        const [ev, cr] = await Promise.all([
          MatchEventsAPI.getByMatch(match.id),
          DisciplinaryAPI.getByMatch(match.id),
        ]);
        setEvents(ev);
        setCards(cr);
        setLoaded(true);
      } catch (err) {
        toast.error("Failed to load events & cards");
      } finally {
        setLoading(false);
      }
    }
  };

  const loadRoster = async (teamId) => {
    if (!teamId || rosters[teamId] !== undefined) return;
    try {
      const roster = await TeamAPI.getAdminTeamRoster(teamId);
      setRosters(prev => ({ ...prev, [teamId]: roster || [] }));
    } catch (err) {
      setRosters(prev => ({ ...prev, [teamId]: [] }));
    }
  };

  const handleTeamChange = (setForm) => (e) => {
    const idx = e.target.value;
    const team = matchTeams[idx];
    setForm(prev => ({ ...prev, team_idx: idx, team_id: team?.id || "", team_name: team?.name || "", player_accreditation_id: "", player_name: "" }));
    if (team?.id) loadRoster(team.id);
  };

  const handleRosterPick = (form, setForm) => (e) => {
    const accId = e.target.value;
    if (!accId) return;
    const roster = rosters[form.team_id] || [];
    const entry = roster.find(r => r.accreditation_id === accId);
    const acc = entry?.accreditations;
    const name = acc ? `${acc.first_name || ""} ${acc.last_name || ""}`.trim() : "";
    setForm(prev => ({ ...prev, player_accreditation_id: accId, player_name: name || prev.player_name }));
  };

  const handleAddEvent = async () => {
    if (disabled || savingEvent) return;
    if (!eventForm.player_name.trim()) {
      toast.error("Player name is required");
      return;
    }
    setSavingEvent(true);
    try {
      const payload = {
        event_id: match.event_id,
        match_id: match.id,
        team_id: eventForm.team_id || null,
        team_name: eventForm.team_name || null,
        player_accreditation_id: eventForm.player_accreditation_id || null,
        player_name: eventForm.player_name.trim(),
        event_type: (eventForm.event_type || "Goal").trim() || "Goal",
        minute: eventForm.minute.trim() || null,
        notes: eventForm.notes.trim() || null,
      };
      const saved = await MatchEventsAPI.save(payload);
      setEvents(prev => [...prev, saved]);
      setEventForm(emptyEventForm);
      toast.success("Event added");
    } catch (err) {
      toast.error("Failed to add event");
    } finally {
      setSavingEvent(false);
    }
  };

  const handleDeleteEvent = async (id) => {
    if (disabled) return;
    if (!window.confirm("Delete this event?")) return;
    try {
      await MatchEventsAPI.delete(id);
      setEvents(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      toast.error("Failed to delete event");
    }
  };

  const handleAddCard = async () => {
    if (disabled || savingCard) return;
    if (!cardForm.player_name.trim()) {
      toast.error("Player name is required");
      return;
    }
    setSavingCard(true);
    try {
      const payload = {
        event_id: match.event_id,
        match_id: match.id,
        sport_id: match.sport_id || null,
        team_id: cardForm.team_id || null,
        team_name: cardForm.team_name || null,
        player_accreditation_id: cardForm.player_accreditation_id || null,
        player_name: cardForm.player_name.trim(),
        match_title: match.match_title || null,
        competition: sportName || null,
        match_date: match.match_date || null,
        card_type: cardForm.card_type,
        reason: cardForm.reason.trim() || null,
        minute: cardForm.minute.trim() || null,
      };
      const saved = await DisciplinaryAPI.save(payload);
      setCards(prev => [...prev, saved]);
      setCardForm(emptyCardForm);
      toast.success("Card recorded");
    } catch (err) {
      toast.error("Failed to record card");
    } finally {
      setSavingCard(false);
    }
  };

  const handleDeleteCard = async (id) => {
    if (disabled) return;
    if (!window.confirm("Delete this card?")) return;
    try {
      await DisciplinaryAPI.delete(id);
      setCards(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      toast.error("Failed to delete card");
    }
  };

  const totalCount = events.length + cards.length;
  const inputClass = "w-full bg-slate-800 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs outline-none focus:border-emerald-500/50";

  return (
    <div className="mt-3 pt-3 border-t border-white/5">
      <button onClick={toggleExpand} className="w-full flex items-center justify-between text-xs font-bold text-slate-400 hover:text-emerald-400 transition-colors uppercase tracking-widest">
        <span className="flex items-center gap-1.5">
          <Goal className="w-3.5 h-3.5" /> Events &amp; Cards{loaded && totalCount > 0 ? ` (${totalCount})` : ""}
        </span>
        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="pt-3 space-y-4">
              {loading ? (
                <p className="text-xs text-slate-500">Loading...</p>
              ) : (
                <>
                  {/* Goal / Point Scorers */}
                  <div className="space-y-2">
                    <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Goal / Point Scorers</h5>
                    {events.length === 0 ? (
                      <p className="text-xs text-slate-500">No events recorded yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {events.map(ev => (
                          <div key={ev.id} className="flex items-center justify-between gap-2 bg-slate-800/50 border border-white/5 rounded-lg px-3 py-1.5">
                            <div className="text-xs text-white min-w-0 truncate">
                              <span className="font-bold text-emerald-400">{ev.event_type}</span>
                              {" "}— {ev.player_name}
                              {ev.team_name && <span className="text-slate-500"> ({ev.team_name})</span>}
                              {ev.minute && <span className="text-slate-500"> · {ev.minute}'</span>}
                              {ev.notes && <span className="text-slate-500"> · {ev.notes}</span>}
                            </div>
                            {!disabled && (
                              <button onClick={() => handleDeleteEvent(ev.id)} className="text-red-400 hover:text-red-300 p-1 shrink-0">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {!disabled && (
                      <div className="bg-slate-900/60 border border-white/5 rounded-xl p-3 space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <select value={eventForm.team_idx} onChange={handleTeamChange(setEventForm)} className={inputClass}>
                            <option value="">Team...</option>
                            {matchTeams.map((t, idx) => <option key={idx} value={idx}>{t.name}</option>)}
                          </select>
                          {eventForm.team_id && (rosters[eventForm.team_id]?.length > 0) ? (
                            <select value={eventForm.player_accreditation_id} onChange={handleRosterPick(eventForm, setEventForm)} className={inputClass}>
                              <option value="">Roster...</option>
                              {rosters[eventForm.team_id].map(r => (
                                <option key={r.accreditation_id} value={r.accreditation_id}>
                                  {`${r.accreditations?.first_name || ""} ${r.accreditations?.last_name || ""}`.trim()}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input type="text" placeholder="Player name" value={eventForm.player_name} onChange={e => setEventForm(prev => ({ ...prev, player_name: e.target.value, player_accreditation_id: "" }))} className={inputClass} />
                          )}
                          <input type="text" placeholder="Type (Goal)" list="match-event-type-suggestions" value={eventForm.event_type} onChange={e => setEventForm(prev => ({ ...prev, event_type: e.target.value }))} className={inputClass} />
                          <input type="text" placeholder="Min" value={eventForm.minute} onChange={e => setEventForm(prev => ({ ...prev, minute: e.target.value }))} className={inputClass} />
                        </div>
                        {eventForm.team_id && (rosters[eventForm.team_id]?.length > 0) && (
                          <input type="text" placeholder="Player name (override)" value={eventForm.player_name} onChange={e => setEventForm(prev => ({ ...prev, player_name: e.target.value, player_accreditation_id: "" }))} className={inputClass} />
                        )}
                        <div className="flex gap-2">
                          <input type="text" placeholder="Notes (optional)" value={eventForm.notes} onChange={e => setEventForm(prev => ({ ...prev, notes: e.target.value }))} className={cn(inputClass, "flex-1")} />
                          <button onClick={handleAddEvent} disabled={savingEvent} className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 disabled:opacity-50">
                            <Plus className="w-3.5 h-3.5" /> Add
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Disciplinary Cards */}
                  <div className="space-y-2">
                    <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Disciplinary Cards</h5>
                    {cards.length === 0 ? (
                      <p className="text-xs text-slate-500">No cards recorded yet.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {cards.map(c => (
                          <div key={c.id} className="flex items-center justify-between gap-2 bg-slate-800/50 border border-white/5 rounded-lg px-3 py-1.5">
                            <div className="text-xs text-white min-w-0 truncate flex items-center gap-1.5">
                              <span className={cn("inline-block w-2.5 h-3.5 rounded-sm shrink-0", c.card_type === "Red" ? "bg-red-500" : "bg-amber-400")} />
                              {c.player_name}
                              {c.team_name && <span className="text-slate-500"> ({c.team_name})</span>}
                              {c.minute && <span className="text-slate-500"> · {c.minute}'</span>}
                              {c.reason && <span className="text-slate-500"> · {c.reason}</span>}
                            </div>
                            {!disabled && (
                              <button onClick={() => handleDeleteCard(c.id)} className="text-red-400 hover:text-red-300 p-1 shrink-0">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {!disabled && (
                      <div className="bg-slate-900/60 border border-white/5 rounded-xl p-3 space-y-2">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <select value={cardForm.team_idx} onChange={handleTeamChange(setCardForm)} className={inputClass}>
                            <option value="">Team...</option>
                            {matchTeams.map((t, idx) => <option key={idx} value={idx}>{t.name}</option>)}
                          </select>
                          {cardForm.team_id && (rosters[cardForm.team_id]?.length > 0) ? (
                            <select value={cardForm.player_accreditation_id} onChange={handleRosterPick(cardForm, setCardForm)} className={inputClass}>
                              <option value="">Roster...</option>
                              {rosters[cardForm.team_id].map(r => (
                                <option key={r.accreditation_id} value={r.accreditation_id}>
                                  {`${r.accreditations?.first_name || ""} ${r.accreditations?.last_name || ""}`.trim()}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input type="text" placeholder="Player name" value={cardForm.player_name} onChange={e => setCardForm(prev => ({ ...prev, player_name: e.target.value, player_accreditation_id: "" }))} className={inputClass} />
                          )}
                          <select value={cardForm.card_type} onChange={e => setCardForm(prev => ({ ...prev, card_type: e.target.value }))} className={inputClass}>
                            {CARD_TYPES.map(ct => <option key={ct} value={ct}>{ct} Card</option>)}
                          </select>
                          <input type="text" placeholder="Min" value={cardForm.minute} onChange={e => setCardForm(prev => ({ ...prev, minute: e.target.value }))} className={inputClass} />
                        </div>
                        {cardForm.team_id && (rosters[cardForm.team_id]?.length > 0) && (
                          <input type="text" placeholder="Player name (override)" value={cardForm.player_name} onChange={e => setCardForm(prev => ({ ...prev, player_name: e.target.value, player_accreditation_id: "" }))} className={inputClass} />
                        )}
                        <div className="flex gap-2">
                          <input type="text" placeholder="Reason (optional)" value={cardForm.reason} onChange={e => setCardForm(prev => ({ ...prev, reason: e.target.value }))} className={cn(inputClass, "flex-1")} />
                          <button onClick={handleAddCard} disabled={savingCard} className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 disabled:opacity-50">
                            <ShieldAlert className="w-3.5 h-3.5" /> Add
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <datalist id="match-event-type-suggestions">
        {EVENT_TYPE_SUGGESTIONS.map(t => <option key={t} value={t} />)}
      </datalist>
    </div>
  );
}
