import React, { useState, useEffect, useMemo } from "react";
import { Wand2, Shuffle, Info } from "lucide-react";
import { toast } from "sonner";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { LiveScoresAPI } from "../../lib/storage";
import { FORMAT_OPTIONS, generateFixtures, buildMatchRows } from "../../lib/fixtureGenerators";

const inputClass = "w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500";
const labelClass = "text-[10px] font-bold text-slate-500 uppercase tracking-widest";

// Admin modal: pick a competition format for a sport and auto-generate
// live_score_matches fixtures for the selected teams. Generation is
// additive-only - it never deletes or modifies existing matches.
export default function GenerateFixturesModal({ isOpen, onClose, sport, eventId, teams, divisions, teamDivisions, onGenerated }) {
  const [format, setFormat] = useState("Round Robin");
  const [doubleRound, setDoubleRound] = useState(false);
  const [numGroups, setNumGroups] = useState(2);
  const [advancePerGroup, setAdvancePerGroup] = useState(2);
  const [numConferences, setNumConferences] = useState(2);
  const [useDivisions, setUseDivisions] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [daysBetweenRounds, setDaysBetweenRounds] = useState(7);
  const [venue, setVenue] = useState("");
  const [generating, setGenerating] = useState(false);

  const hasUsableDivisions = (divisions || []).length >= 2;

  useEffect(() => {
    if (!isOpen || !sport) return;
    setFormat(sport.format || "Round Robin");
    setDoubleRound(!!sport.format_config?.doubleRound);
    setNumGroups(sport.format_config?.numGroups || 2);
    setAdvancePerGroup(sport.format_config?.advancePerGroup ?? 2);
    setNumConferences(sport.format_config?.numConferences || 2);
    setUseDivisions(false);
    setStartDate(new Date().toISOString().split("T")[0]);
    setDaysBetweenRounds(7);
    setVenue("");

    (async () => {
      try {
        const registeredIds = await LiveScoresAPI.getTeamIdsForSport(teams.map(t => t.id), sport.sport_name);
        setSelectedTeamIds(registeredIds.length > 0 ? registeredIds : teams.map(t => t.id));
      } catch {
        setSelectedTeamIds(teams.map(t => t.id));
      }
    })();
  }, [isOpen, sport]);

  const selectedTeams = useMemo(
    () => selectedTeamIds.map(id => teams.find(t => t.id === id)).filter(Boolean).map(t => ({ id: t.id, name: t.name })),
    [selectedTeamIds, teams]
  );

  const divisionGroups = useMemo(() => {
    if (!useDivisions || !hasUsableDivisions) return null;
    const map = new Map();
    selectedTeams.forEach(t => {
      const divId = teamDivisions?.[t.id] || "unassigned";
      if (!map.has(divId)) map.set(divId, []);
      map.get(divId).push(t);
    });
    return Array.from(map.values()).filter(g => g.length > 0);
  }, [useDivisions, hasUsableDivisions, selectedTeams, teamDivisions]);

  const options = useMemo(() => ({
    doubleRound,
    numGroups: Number(numGroups) || 2,
    advancePerGroup: Number(advancePerGroup) || 0,
    numConferences: Number(numConferences) || 2,
    divisionGroups,
  }), [doubleRound, numGroups, advancePerGroup, numConferences, divisionGroups]);

  const preview = useMemo(() => {
    if (format === "Custom" || selectedTeams.length < 2) return [];
    try {
      return generateFixtures(format, selectedTeams, options);
    } catch {
      return [];
    }
  }, [format, selectedTeams, options]);

  const toggleTeam = (teamId) => {
    setSelectedTeamIds(prev => prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]);
  };

  const selectAll = () => setSelectedTeamIds(teams.map(t => t.id));
  const selectNone = () => setSelectedTeamIds([]);
  const shuffleOrder = () => {
    setSelectedTeamIds(prev => {
      const arr = [...prev];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    });
  };

  const handleGenerate = async () => {
    if (!sport) return;
    setGenerating(true);
    try {
      const formatConfig = (format === "Custom" || format === "Individual") ? null : {
        doubleRound,
        numGroups: Number(numGroups) || 2,
        advancePerGroup: Number(advancePerGroup) || 0,
        numConferences: Number(numConferences) || 2,
        useDivisions,
      };
      const updatedSport = await LiveScoresAPI.saveSport({ id: sport.id, format, format_config: formatConfig });

      let inserted = [];
      if (format !== "Custom" && format !== "Individual") {
        if (selectedTeams.length < 2) {
          toast.error("Select at least 2 teams to generate fixtures");
          setGenerating(false);
          return;
        }
        const rows = buildMatchRows(preview, {
          eventId,
          sportId: sport.id,
          startDate,
          daysBetweenRounds: Number(daysBetweenRounds) || 7,
          venue,
        });
        inserted = await LiveScoresAPI.bulkCreateMatches(rows);
      }

      onGenerated(inserted, updatedSport);
      toast.success((format === "Custom" || format === "Individual") ? "Format saved" : `${inserted.length} fixture${inserted.length === 1 ? "" : "s"} generated`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate fixtures");
    } finally {
      setGenerating(false);
    }
  };

  if (!sport) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Generate Fixtures — ${sport.sport_name}`} size="lg">
      <div className="p-6 space-y-5 bg-slate-900 text-white">
        <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-200 text-xs">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <p>Generates new fixtures from the teams selected below. Existing matches for this sport are kept as-is — nothing is deleted or overwritten.</p>
        </div>

        {/* Format */}
        <div className="space-y-1">
          <label className={labelClass}>Competition Format</label>
          <select value={format} onChange={e => setFormat(e.target.value)} className={inputClass}>
            {FORMAT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <p className="text-xs text-slate-500">{FORMAT_OPTIONS.find(f => f.value === format)?.description}</p>
        </div>

        {format === "Individual" && (
          <div className="flex items-start gap-2 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-200 text-xs">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <p>
              No team-vs-team matches are needed for this sport. Manage the event schedule and
              heat sheets/results in the <strong className="text-indigo-100">Sport Events &amp; Heat Sheets</strong> tab.
              Saving here just marks this sport as Individual so it's grouped correctly in Live Scores.
            </p>
          </div>
        )}

        {format !== "Custom" && format !== "Individual" && (
          <>
            {/* Format-specific options */}
            {format === "Round Robin" && (
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={doubleRound} onChange={e => setDoubleRound(e.target.checked)} className="rounded" />
                Home &amp; Away (double round-robin)
              </label>
            )}

            {format === "Groups + Knockout" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={labelClass}>Number of Groups</label>
                  <input type="number" min="1" value={numGroups} onChange={e => setNumGroups(e.target.value)} className={inputClass} />
                </div>
                <div className="space-y-1">
                  <label className={labelClass}>Advance per Group to Knockout</label>
                  <input type="number" min="0" value={advancePerGroup} onChange={e => setAdvancePerGroup(e.target.value)} className={inputClass} />
                  <p className="text-[10px] text-slate-500">0 = group stage only, no knockout.</p>
                </div>
              </div>
            )}

            {format === "Conference" && (
              <div className="space-y-3">
                {hasUsableDivisions && (
                  <label className="flex items-center gap-2 text-sm text-slate-300">
                    <input type="checkbox" checked={useDivisions} onChange={e => setUseDivisions(e.target.checked)} className="rounded" />
                    Use existing divisions as conferences
                  </label>
                )}
                {!(useDivisions && hasUsableDivisions) && (
                  <div className="space-y-1">
                    <label className={labelClass}>Number of Conferences</label>
                    <input type="number" min="2" value={numConferences} onChange={e => setNumConferences(e.target.value)} className={inputClass} />
                  </div>
                )}
              </div>
            )}

            {/* Scheduling */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className={labelClass}>Start Date</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputClass} />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Days Between Rounds</label>
                <input type="number" min="1" value={daysBetweenRounds} onChange={e => setDaysBetweenRounds(e.target.value)} className={inputClass} />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Venue (optional)</label>
                <input type="text" value={venue} onChange={e => setVenue(e.target.value)} placeholder="Applies to all" className={inputClass} />
              </div>
            </div>

            {/* Team selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className={labelClass}>Teams &amp; Seeding Order ({selectedTeamIds.length} selected)</label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={selectAll} className="text-xs text-blue-400 hover:underline">All</button>
                  <button type="button" onClick={selectNone} className="text-xs text-blue-400 hover:underline">None</button>
                  <button type="button" onClick={shuffleOrder} className="text-xs text-blue-400 hover:underline flex items-center gap-1">
                    <Shuffle className="w-3 h-3" /> Shuffle
                  </button>
                </div>
              </div>
              <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
                {selectedTeamIds.map((id, i) => {
                  const team = teams.find(t => t.id === id);
                  if (!team) return null;
                  return (
                    <div key={id} className="flex items-center gap-2 bg-slate-800/50 border border-white/5 rounded-lg px-2 py-1.5">
                      <span className="text-[10px] text-slate-500 w-5 text-center">{i + 1}</span>
                      <span className="flex-1 text-sm text-white truncate">{team.name}</span>
                      <button type="button" onClick={() => toggleTeam(id)} className="text-xs text-red-400 hover:underline">Remove</button>
                    </div>
                  );
                })}
                {teams.filter(t => !selectedTeamIds.includes(t.id)).map(team => (
                  <div key={team.id} className="flex items-center gap-2 bg-slate-900/40 border border-white/5 rounded-lg px-2 py-1.5 opacity-60">
                    <span className="w-5" />
                    <span className="flex-1 text-sm text-slate-400 truncate">{team.name}</span>
                    <button type="button" onClick={() => toggleTeam(team.id)} className="text-xs text-emerald-400 hover:underline">Add</button>
                  </div>
                ))}
                {teams.length === 0 && <p className="text-xs text-slate-500">No teams registered for this event yet.</p>}
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <label className={labelClass}>Preview ({preview.length} fixture{preview.length === 1 ? "" : "s"})</label>
              <div className="max-h-48 overflow-y-auto space-y-1 pr-1 bg-slate-950/50 border border-white/5 rounded-lg p-2">
                {preview.length === 0 ? (
                  <p className="text-xs text-slate-500 p-2">Select at least 2 teams to preview fixtures.</p>
                ) : preview.map((m, i) => (
                  <div key={i} className="flex items-center justify-between text-xs text-slate-300 px-2 py-1 rounded hover:bg-white/5">
                    <span className="text-slate-500 w-32 shrink-0 truncate">{m.match_title}</span>
                    <span className="flex-1 text-right truncate">{m.team_a_name}</span>
                    <span className="px-2 text-slate-500">vs</span>
                    <span className="flex-1 truncate">{m.team_b_name}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
          <Button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 text-white">Cancel</Button>
          <Button onClick={handleGenerate} loading={generating} variant="primary" icon={Wand2}>
            {(format === "Custom" || format === "Individual") ? "Save Format" : "Generate Fixtures"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
