import React, { useState, useEffect, useMemo } from "react";
import { Wand2, Shuffle, Info, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { LiveScoresAPI, DivisionsAPI, AreasAPI } from "../../lib/storage";
import { FORMAT_OPTIONS, generateFixtures, buildMatchRows } from "../../lib/fixtureGenerators";
import { cn } from "../../lib/utils";

const inputClass = "w-full bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500";
const labelClass = "text-[10px] font-bold text-slate-500 uppercase tracking-widest";

const GROUP_BASED_FORMATS = ["Groups + Knockout", "Conference"];

// Admin modal: pick a competition format for a sport, set up its Areas/
// Conferences and Groups/Pools (for group-based formats), assign teams to
// them, and auto-generate live_score_matches fixtures. Generation is
// additive-only - it never deletes or modifies existing matches. Area/Group
// setup here writes directly to the same competition_areas/
// competition_divisions/team_sports.division_id tables used by the League
// Standings panel, so the two stay in sync regardless of where an admin
// edits them - this modal is just the place where it's expected to all
// happen as part of generating fixtures.
export default function GenerateFixturesModal({ isOpen, onClose, sport, eventId, teams, existingLeagues, existingSportMatchCount, onGenerated }) {
  const [format, setFormat] = useState("Round Robin");
  const [doubleRound, setDoubleRound] = useState(false);
  const [numGroups, setNumGroups] = useState(2);
  const [advancePerGroup, setAdvancePerGroup] = useState(2);
  const [thirdPlaceMatch, setThirdPlaceMatch] = useState(false);
  const [bestThirdPlaceCount, setBestThirdPlaceCount] = useState(0);
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);
  const [eligibleTeamIds, setEligibleTeamIds] = useState([]);
  const [groupAssignments, setGroupAssignments] = useState({}); // legacy fallback (no Divisions yet): teamId -> numeric group index
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [daysBetweenRounds, setDaysBetweenRounds] = useState(7);
  const [venue, setVenue] = useState("");
  const [leagueName, setLeagueName] = useState("");
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Areas/Conferences + Groups/Divisions setup, scoped to this sport.
  const [areas, setAreas] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [teamDivisionMap, setTeamDivisionMap] = useState({});
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaCities, setNewAreaCities] = useState("");
  const [newDivisionName, setNewDivisionName] = useState("");
  const [newDivisionAreaId, setNewDivisionAreaId] = useState("");

  const isGroupBased = GROUP_BASED_FORMATS.includes(format);

  useEffect(() => {
    if (!isOpen || !sport) return;
    setFormat(sport.format || "Round Robin");
    setDoubleRound(!!sport.format_config?.doubleRound);
    setNumGroups(sport.format_config?.numGroups || 2);
    setAdvancePerGroup(sport.format_config?.advancePerGroup ?? 2);
    setThirdPlaceMatch(!!sport.format_config?.thirdPlaceMatch);
    setBestThirdPlaceCount(sport.format_config?.bestThirdPlaceCount || 0);
    setGroupAssignments({});
    setStartDate(new Date().toISOString().split("T")[0]);
    setDaysBetweenRounds(7);
    setVenue("");
    setLeagueName("");
    setReplaceExisting(false);
    setNewAreaName("");
    setNewAreaCities("");
    setNewDivisionName("");
    setNewDivisionAreaId("");

    (async () => {
      try {
        const [registeredIds, divs, ars] = await Promise.all([
          LiveScoresAPI.getTeamIdsForSport(teams.map(t => t.id), sport.sport_name, sport.gender),
          DivisionsAPI.getBySport(sport.id),
          AreasAPI.getBySport(sport.id),
        ]);
        setEligibleTeamIds(registeredIds);
        setSelectedTeamIds(registeredIds);
        setDivisions(divs);
        setAreas(ars);
        const tds = await LiveScoresAPI.getTeamSportDivisions(teams.map(t => t.id), sport.sport_name);
        const map = {};
        tds.forEach(td => { map[td.team_id] = td.division_id || ""; });

        // Auto-run city -> area -> group assignment for any still-unassigned
        // registered team, if Areas (with cities) and Groups already exist
        // for this sport. Only fills in genuinely unassigned teams - never
        // overwrites an assignment someone already made by hand.
        const areaList = ars.filter(a => (a.cities || []).length > 0);
        if (areaList.length > 0 && divs.length > 0) {
          const cityToAreaId = {};
          areaList.forEach(a => (a.cities || []).forEach(c => { cityToAreaId[c.toLowerCase()] = a.id; }));
          const divisionsByArea = {};
          divs.forEach(d => {
            if (!d.area_id) return;
            if (!divisionsByArea[d.area_id]) divisionsByArea[d.area_id] = [];
            divisionsByArea[d.area_id].push(d.id);
          });
          const counts = {};
          Object.values(map).forEach(divId => { if (divId) counts[divId] = (counts[divId] || 0) + 1; });
          const assignments = [];
          registeredIds.forEach(teamId => {
            if (map[teamId]) return;
            const team = teams.find(tm => tm.id === teamId);
            const areaId = team?.city ? cityToAreaId[team.city.toLowerCase()] : null;
            const candidateIds = areaId ? (divisionsByArea[areaId] || []) : [];
            if (candidateIds.length === 0) return;
            let best = candidateIds[0];
            candidateIds.forEach(dId => {
              counts[dId] = counts[dId] || 0;
              if (counts[dId] < (counts[best] || 0)) best = dId;
            });
            counts[best] = (counts[best] || 0) + 1;
            assignments.push({ teamId, sportName: sport.sport_name, divisionId: best });
            map[teamId] = best;
          });
          if (assignments.length > 0) {
            await LiveScoresAPI.bulkSetTeamDivisions(assignments);
            toast.success(`Auto-assigned ${assignments.length} team${assignments.length === 1 ? "" : "s"} by location`);
          }
        }

        setTeamDivisionMap(map);
      } catch {
        setEligibleTeamIds([]);
        setSelectedTeamIds([]);
        setDivisions([]);
        setAreas([]);
        setTeamDivisionMap({});
      }
    })();
  }, [isOpen, sport]);

  const eligibleTeams = useMemo(
    () => eligibleTeamIds.map(id => teams.find(t => t.id === id)).filter(Boolean),
    [eligibleTeamIds, teams]
  );

  const selectedTeams = useMemo(
    () => selectedTeamIds.map(id => teams.find(t => t.id === id)).filter(Boolean).map(t => ({ id: t.id, name: t.name })),
    [selectedTeamIds, teams]
  );

  // Real groups, built from competition_divisions + each team's persisted
  // division assignment. Selected teams with no assignment yet are spread
  // evenly across the existing divisions (least-filled first) purely for
  // fixture generation - nothing is silently dropped, but admins should
  // still assign them properly via the picker below for accurate standings.
  const realGroups = useMemo(() => {
    if (!isGroupBased || divisions.length === 0) return null;
    const groups = divisions.map(() => []);
    const unassigned = [];
    selectedTeams.forEach(t => {
      const divId = teamDivisionMap[t.id];
      const idx = divId ? divisions.findIndex(d => d.id === divId) : -1;
      if (idx >= 0) groups[idx].push(t);
      else unassigned.push(t);
    });
    unassigned.forEach(t => {
      let minIdx = 0;
      for (let i = 1; i < groups.length; i++) {
        if (groups[i].length < groups[minIdx].length) minIdx = i;
      }
      groups[minIdx].push(t);
    });
    return groups;
  }, [isGroupBased, divisions, selectedTeams, teamDivisionMap]);

  const groupDivisionIds = useMemo(() => divisions.map(d => d.id), [divisions]);
  const groupNames = useMemo(() => divisions.map(d => {
    const area = areas.find(a => a.id === d.area_id);
    return area ? `${area.name} – ${d.name}` : d.name;
  }), [divisions, areas]);

  // Legacy fallback (no Divisions created yet for this sport): manual
  // per-team numeric group assignments for "Groups + Knockout". Teams
  // without an explicit assignment are distributed evenly.
  const legacyManualGroups = useMemo(() => {
    if (format !== "Groups + Knockout" || divisions.length > 0) return null;
    const n = Math.max(1, Number(numGroups) || 2);
    const hasManual = selectedTeams.some(t => {
      const g = groupAssignments[t.id];
      return g !== undefined && g !== null && g !== "" && Number(g) < n;
    });
    if (!hasManual) return null;

    const groups = Array.from({ length: n }, () => []);
    const unassigned = [];
    selectedTeams.forEach(t => {
      const g = groupAssignments[t.id];
      if (g !== undefined && g !== null && g !== "" && Number(g) < n) {
        groups[Number(g)].push(t);
      } else {
        unassigned.push(t);
      }
    });
    unassigned.forEach(t => {
      let minIdx = 0;
      for (let i = 1; i < n; i++) {
        if (groups[i].length < groups[minIdx].length) minIdx = i;
      }
      groups[minIdx].push(t);
    });
    return groups;
  }, [format, divisions, selectedTeams, groupAssignments, numGroups]);

  const options = useMemo(() => {
    const useRealGroups = isGroupBased && divisions.length > 0;
    return {
      doubleRound,
      numGroups: Number(numGroups) || 2,
      advancePerGroup: Number(advancePerGroup) || 0,
      thirdPlaceMatch,
      bestThirdPlaceCount: Number(bestThirdPlaceCount) || 0,
      numConferences: Number(numGroups) || 2,
      manualGroups: format === "Groups + Knockout" ? (useRealGroups ? realGroups : legacyManualGroups) : null,
      divisionGroups: format === "Conference" ? (useRealGroups ? realGroups : null) : null,
      groupDivisionIds: useRealGroups ? groupDivisionIds : null,
      groupNames: useRealGroups ? groupNames : null,
    };
  }, [isGroupBased, divisions, doubleRound, numGroups, advancePerGroup, thirdPlaceMatch, bestThirdPlaceCount, format, realGroups, legacyManualGroups, groupDivisionIds, groupNames]);

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

  const selectAll = () => setSelectedTeamIds(eligibleTeamIds);
  const selectNone = () => setSelectedTeamIds([]);
  const setTeamGroup = (teamId, groupValue) => {
    setGroupAssignments(prev => ({ ...prev, [teamId]: groupValue }));
  };
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

  // --- Areas / Groups setup (writes straight to competition_areas /
  // competition_divisions / team_sports.division_id - the same tables the
  // League Standings panel reads/edits) -----------------------------------

  const handleAddArea = async () => {
    if (!sport || !newAreaName.trim()) return;
    try {
      const cities = newAreaCities.split(",").map(c => c.trim()).filter(Boolean);
      const saved = await AreasAPI.save({ event_id: eventId, sport_id: sport.id, name: newAreaName.trim(), cities, display_order: areas.length });
      setAreas(prev => [...prev, saved]);
      setNewAreaName("");
      setNewAreaCities("");
    } catch {
      toast.error("Failed to add area");
    }
  };

  const handleDeleteArea = async (id) => {
    if (!window.confirm("Delete this area/conference? Groups assigned to it will become unassigned.")) return;
    try {
      await AreasAPI.delete(id);
      setAreas(prev => prev.filter(a => a.id !== id));
      setDivisions(prev => prev.map(d => d.area_id === id ? { ...d, area_id: null } : d));
    } catch {
      toast.error("Failed to delete area");
    }
  };

  const handleCreateGroups = async () => {
    if (!sport) return;
    const n = Math.max(1, Number(numGroups) || 2);
    try {
      const created = [];
      for (let i = 0; i < n; i++) {
        const saved = await DivisionsAPI.save({ event_id: eventId, sport_id: sport.id, name: `Group ${String.fromCharCode(65 + i)}`, display_order: divisions.length + i });
        created.push(saved);
      }
      setDivisions(prev => [...prev, ...created]);
      toast.success(`Created ${n} group${n === 1 ? "" : "s"}`);
    } catch {
      toast.error("Failed to create groups");
    }
  };

  const handleAddDivision = async () => {
    if (!sport || !newDivisionName.trim()) return;
    try {
      const saved = await DivisionsAPI.save({ event_id: eventId, sport_id: sport.id, name: newDivisionName.trim(), area_id: newDivisionAreaId || null, display_order: divisions.length });
      setDivisions(prev => [...prev, saved]);
      setNewDivisionName("");
      setNewDivisionAreaId("");
    } catch {
      toast.error("Failed to add group");
    }
  };

  const handleDeleteDivision = async (id) => {
    if (!window.confirm("Delete this group? Teams assigned to it will become unassigned.")) return;
    try {
      await DivisionsAPI.delete(id);
      setDivisions(prev => prev.filter(d => d.id !== id));
      setTeamDivisionMap(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(tid => { if (next[tid] === id) next[tid] = ""; });
        return next;
      });
    } catch {
      toast.error("Failed to delete group");
    }
  };

  const handleDivisionAreaChange = async (divisionId, areaId) => {
    try {
      const saved = await DivisionsAPI.save({ id: divisionId, area_id: areaId || null });
      setDivisions(prev => prev.map(d => d.id === divisionId ? saved : d));
    } catch {
      toast.error("Failed to update group's area");
    }
  };

  const handleTeamDivisionChange = async (teamId, divisionId) => {
    setTeamDivisionMap(prev => ({ ...prev, [teamId]: divisionId }));
    try {
      await LiveScoresAPI.setTeamSportDivision(teamId, sport.sport_name, divisionId || null);
    } catch {
      toast.error("Failed to save team's group assignment");
    }
  };

  // Auto-assign by team location: matches each selected team's `city` to an
  // Area's `cities` list, then places it in the least-filled Group within
  // that Area, persisting immediately via setTeamSportDivision. Admin can
  // still hand-edit any assignment afterwards.
  const hasUsableAreas = areas.some(a => (a.cities || []).length > 0);
  const autoAssignByLocation = async () => {
    const areaList = areas.filter(a => (a.cities || []).length > 0);
    if (areaList.length === 0) return;
    const cityToAreaId = {};
    areaList.forEach(a => (a.cities || []).forEach(c => { cityToAreaId[c.toLowerCase()] = a.id; }));
    const divisionsByArea = {};
    divisions.forEach(d => {
      if (!d.area_id) return;
      if (!divisionsByArea[d.area_id]) divisionsByArea[d.area_id] = [];
      divisionsByArea[d.area_id].push(d.id);
    });

    const counts = {};
    const assignments = [];
    const nextMap = { ...teamDivisionMap };
    selectedTeams.forEach(t => {
      const team = teams.find(tm => tm.id === t.id);
      const areaId = team?.city ? cityToAreaId[team.city.toLowerCase()] : null;
      const candidateIds = areaId ? (divisionsByArea[areaId] || []) : [];
      if (candidateIds.length === 0) return;
      let best = candidateIds[0];
      candidateIds.forEach(dId => {
        counts[dId] = counts[dId] || 0;
        if (counts[dId] < (counts[best] || 0)) best = dId;
      });
      counts[best] = (counts[best] || 0) + 1;
      assignments.push({ teamId: t.id, sportName: sport.sport_name, divisionId: best });
      nextMap[t.id] = best;
    });

    if (assignments.length === 0) {
      toast.error("No teams matched an area's cities - check team locations and area city lists");
      return;
    }
    try {
      await LiveScoresAPI.bulkSetTeamDivisions(assignments);
      setTeamDivisionMap(nextMap);
      toast.success(`Assigned ${assignments.length} team${assignments.length === 1 ? "" : "s"} by location`);
    } catch {
      toast.error("Failed to auto-assign by location");
    }
  };

  const handleGenerate = async () => {
    if (!sport) return;
    setGenerating(true);
    try {
      const formatConfig = (format === "Custom" || format === "Individual") ? null : {
        doubleRound,
        numGroups: Number(numGroups) || 2,
        advancePerGroup: Number(advancePerGroup) || 0,
        thirdPlaceMatch,
        bestThirdPlaceCount: Number(bestThirdPlaceCount) || 0,
      };
      const updatedSport = await LiveScoresAPI.saveSport({ id: sport.id, format, format_config: formatConfig });

      let inserted = [];
      let deletedCount = 0;
      if (format !== "Custom" && format !== "Individual") {
        if (selectedTeams.length < 2) {
          toast.error("Select at least 2 teams to generate fixtures");
          setGenerating(false);
          return;
        }

        // Replace mode: delete existing fixtures before inserting
        if (replaceExisting) {
          const trimmed = leagueName.trim();
          if (trimmed) {
            const deleted = await LiveScoresAPI.deleteLeague(eventId, sport.id, trimmed);
            deletedCount = deleted?.length || 0;
          } else {
            const deleted = await LiveScoresAPI.deleteAllMatchesBySport(eventId, sport.id);
            deletedCount = deleted?.length || 0;
          }
        }

        const rows = buildMatchRows(preview, {
          eventId,
          sportId: sport.id,
          startDate,
          daysBetweenRounds: Number(daysBetweenRounds) || 7,
          venue,
          leagueName: leagueName.trim(),
        });
        inserted = await LiveScoresAPI.bulkCreateMatches(rows);
      }

      onGenerated(inserted, updatedSport, replaceExisting ? { sportId: sport.id, leagueName: leagueName.trim() } : null);
      toast.success((format === "Custom" || format === "Individual") ? "Format saved" : `${inserted.length} fixture${inserted.length === 1 ? "" : "s"} generated${deletedCount > 0 ? ` (replaced ${deletedCount} old)` : ""}`);
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Generate Fixtures — ${sport.sport_name}${sport.gender ? ` (${sport.gender})` : ""}`}
      size="xl"
      footer={
        <div className="flex justify-end gap-3">
          <Button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 text-white">Cancel</Button>
          <Button onClick={handleGenerate} loading={generating} variant="primary" icon={Wand2}>
            {(format === "Custom" || format === "Individual") ? "Save Format" : "Generate Fixtures"}
          </Button>
        </div>
      }
    >
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

            {/* Areas/Conferences & Groups/Pools setup - the structure teams get
                assigned into before fixtures are generated. Shared by Groups +
                Knockout and Conference. */}
            {isGroupBased && (
              <div className="space-y-4 bg-slate-950/40 border border-white/10 rounded-xl p-4">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-widest">Areas / Conferences &amp; Groups Setup</h4>

                <div className="space-y-2">
                  <label className={labelClass}>Areas / Conferences (optional)</label>
                  {areas.length > 0 && (
                    <div className="space-y-1.5">
                      {areas.map(a => (
                        <div key={a.id} className="flex items-center justify-between bg-slate-800/50 p-2 rounded-lg border border-white/5">
                          <span className="text-white text-sm font-medium">
                            {a.name}
                            {(a.cities || []).length > 0 && <span className="text-slate-500"> · {a.cities.join(", ")}</span>}
                          </span>
                          <button onClick={() => handleDeleteArea(a.id)} className="text-red-400 hover:text-red-300 p-1">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <input type="text" placeholder="New Area Name (e.g. Eastern Conference)" value={newAreaName} onChange={e => setNewAreaName(e.target.value)} className="flex-1 min-w-[180px] bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none" />
                    <input type="text" placeholder="Cities, comma separated (e.g. Ajman, Sharjah)" value={newAreaCities} onChange={e => setNewAreaCities(e.target.value)} className="flex-1 min-w-[220px] bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none" />
                    <Button onClick={handleAddArea} className="bg-blue-600 hover:bg-blue-500 text-white px-3"><Plus className="w-4 h-4" /></Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className={labelClass}>{format === "Conference" ? "Conferences / Groups" : "Groups / Pools"}</label>
                  {divisions.length === 0 ? (
                    <div className="flex items-end gap-3">
                      <div className="space-y-1">
                        <label className={labelClass}>Number of Groups</label>
                        <input type="number" min="1" value={numGroups} onChange={e => setNumGroups(e.target.value)} className={inputClass} />
                      </div>
                      <Button onClick={handleCreateGroups} className="bg-blue-600 hover:bg-blue-500 text-white">Create Groups</Button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        {divisions.map(d => (
                          <div key={d.id} className="flex items-center justify-between gap-2 bg-slate-800/50 p-2 rounded-lg border border-white/5">
                            <span className="text-white text-sm font-medium truncate">{d.name}</span>
                            {areas.length > 0 && (
                              <select value={d.area_id || ""} onChange={e => handleDivisionAreaChange(d.id, e.target.value)} className="bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-white text-xs outline-none">
                                <option value="">No Area</option>
                                {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                              </select>
                            )}
                            <button onClick={() => handleDeleteDivision(d.id)} className="text-red-400 hover:text-red-300 p-1">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <input type="text" placeholder="New Group Name (e.g. Group G)" value={newDivisionName} onChange={e => setNewDivisionName(e.target.value)} className="flex-1 min-w-[180px] bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none" />
                        {areas.length > 0 && (
                          <select value={newDivisionAreaId} onChange={e => setNewDivisionAreaId(e.target.value)} className="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none">
                            <option value="">No Area</option>
                            {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </select>
                        )}
                        <Button onClick={handleAddDivision} className="bg-blue-600 hover:bg-blue-500 text-white px-3"><Plus className="w-4 h-4" /></Button>
                      </div>
                    </>
                  )}
                </div>

                {hasUsableAreas && divisions.length > 0 && (
                  <div className="space-y-1">
                    <button type="button" onClick={autoAssignByLocation} className="text-xs text-blue-400 hover:underline">
                      Re-run auto-assign by location
                    </button>
                    <p className="text-[10px] text-slate-500">Unassigned teams are matched by location automatically when this modal opens. Use this to re-match everyone (including teams already assigned) - e.g. after editing an Area's city list.</p>
                  </div>
                )}
              </div>
            )}

            {format === "Groups + Knockout" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className={labelClass}>Advance per Group to Knockout</label>
                    <input type="number" min="0" value={advancePerGroup} onChange={e => setAdvancePerGroup(e.target.value)} className={inputClass} />
                    <p className="text-[10px] text-slate-500">0 = group stage only, no knockout.</p>
                  </div>
                  <div className="space-y-1">
                    <label className={labelClass}>Best 3rd Place Qualifiers</label>
                    <input type="number" min="0" value={bestThirdPlaceCount} onChange={e => setBestThirdPlaceCount(e.target.value)} className={inputClass} />
                    <p className="text-[10px] text-slate-500">Extra knockout slots for the best 3rd-placed teams across all groups.</p>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input type="checkbox" checked={thirdPlaceMatch} onChange={e => setThirdPlaceMatch(e.target.checked)} className="rounded" />
                  3rd Place Playoff (Bronze Medal Match)
                </label>
              </div>
            )}

            {format === "Single Elimination" && (
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={thirdPlaceMatch} onChange={e => setThirdPlaceMatch(e.target.checked)} className="rounded" />
                3rd Place Playoff (Bronze Medal Match)
              </label>
            )}

            {/* Existing match warning + replace option */}
            {existingSportMatchCount > 0 && (
              <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                <div className="flex-1 text-xs text-amber-200">
                  <p className="font-bold mb-1">This sport already has {existingSportMatchCount} matches.</p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={replaceExisting}
                      onChange={e => setReplaceExisting(e.target.checked)}
                      className="rounded"
                    />
                    <span>
                      <strong>Replace existing</strong> — {leagueName.trim() ? `delete all "${leagueName.trim()}" matches first` : "delete ALL matches for this sport first"}, then insert new ones
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* League / Fixture Name */}
            <div className="space-y-1">
              <label className={labelClass}>League / Fixture Name</label>
              <input
                type="text"
                list="gen-fixture-leagues"
                value={leagueName}
                onChange={e => setLeagueName(e.target.value)}
                placeholder="e.g. Premier League, Group Stage, Cup 2026"
                className={inputClass}
              />
              <datalist id="gen-fixture-leagues">
                {(existingLeagues || []).map(l => <option key={l} value={l} />)}
              </datalist>
              <p className="text-[10px] text-slate-500">All generated fixtures will be grouped under this league/fixture name. Leave blank for no grouping.</p>
            </div>

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
              {isGroupBased && eligibleTeams.length > 0 && (
                <p className="text-[11px] text-slate-500">
                  {divisions.length > 0
                    ? "Assign each team to its Area/Group below - this is saved immediately."
                    : 'Optionally assign each team to a specific group below, or create Groups above first. Teams left on "Auto" are distributed evenly.'}
                </p>
              )}
              <div className="max-h-44 overflow-y-auto space-y-1 pr-1">
                {selectedTeamIds.map((id, i) => {
                  const team = teams.find(t => t.id === id);
                  if (!team) return null;
                  return (
                    <div key={id} className="flex items-center gap-2 bg-slate-800/50 border border-white/5 rounded-lg px-2 py-1.5">
                      <span className="text-[10px] text-slate-500 w-5 text-center">{i + 1}</span>
                      <span className="flex-1 text-sm text-white truncate">{team.name}{team.city ? <span className="text-slate-500"> · {team.city}</span> : ""}</span>
                      {format === "Groups + Knockout" && divisions.length === 0 && (
                        <select
                          value={groupAssignments[id] ?? ""}
                          onChange={e => setTeamGroup(id, e.target.value)}
                          className="bg-slate-900 border border-white/10 rounded-lg px-1.5 py-1 text-white text-xs outline-none"
                        >
                          <option value="">Auto</option>
                          {Array.from({ length: Math.max(1, Number(numGroups) || 2) }, (_, gi) => (
                            <option key={gi} value={gi}>Group {String.fromCharCode(65 + gi)}</option>
                          ))}
                        </select>
                      )}
                      {isGroupBased && divisions.length > 0 && (
                        <select
                          value={teamDivisionMap[id] || ""}
                          onChange={e => handleTeamDivisionChange(id, e.target.value)}
                          className="bg-slate-900 border border-white/10 rounded-lg px-1.5 py-1 text-white text-xs outline-none max-w-[200px]"
                        >
                          <option value="">Unassigned</option>
                          {divisions.map(d => {
                            const area = areas.find(a => a.id === d.area_id);
                            return <option key={d.id} value={d.id}>{area ? `${area.name} – ${d.name}` : d.name}</option>;
                          })}
                        </select>
                      )}
                      <button type="button" onClick={() => toggleTeam(id)} className="text-xs text-red-400 hover:underline">Remove</button>
                    </div>
                  );
                })}
                {eligibleTeams.filter(t => !selectedTeamIds.includes(t.id)).map(team => (
                  <div key={team.id} className="flex items-center gap-2 bg-slate-900/40 border border-white/5 rounded-lg px-2 py-1.5 opacity-60">
                    <span className="w-5" />
                    <span className="flex-1 text-sm text-slate-400 truncate">{team.name}</span>
                    <button type="button" onClick={() => toggleTeam(team.id)} className="text-xs text-emerald-400 hover:underline">Add</button>
                  </div>
                ))}
                {eligibleTeams.length === 0 && (
                  <p className="text-xs text-slate-500">
                    No teams have {sport.sport_name}{sport.gender ? ` (${sport.gender})` : ""} registered as a sport yet.
                  </p>
                )}
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <label className={labelClass}>Preview ({preview.length} fixture{preview.length === 1 ? "" : "s"})</label>
              <div className="max-h-48 overflow-y-auto space-y-1 pr-1 bg-slate-950/50 border border-white/5 rounded-lg p-2">
                {preview.length === 0 ? (
                  <p className="text-xs text-slate-500 p-2">Select at least 2 teams to preview fixtures.</p>
                ) : preview.map((m, i) => {
                  const division = m.division_id ? divisions.find(d => d.id === m.division_id) : null;
                  const area = division ? areas.find(a => a.id === division.area_id) : null;
                  return (
                  <div key={i} className="flex items-center justify-between text-xs text-slate-300 px-2 py-1 rounded hover:bg-white/5">
                    <span className={cn(
                      "w-14 shrink-0 text-center text-[9px] font-bold uppercase rounded px-1 py-0.5 mr-2",
                      m.stage === "final" && "bg-amber-500/20 text-amber-300",
                      m.stage === "playoff" && "bg-purple-500/20 text-purple-300",
                      m.stage === "knockout" && "bg-red-500/20 text-red-300",
                      (m.stage === "group" || m.stage === "league" || !m.stage) && "bg-blue-500/20 text-blue-300",
                    )}>{m.stage === "league" || !m.stage ? "—" : m.stage}</span>
                    {division && (
                      <span className="text-[9px] text-slate-500 w-28 shrink-0 truncate" title={area ? `${area.name} – ${division.name}` : division.name}>
                        {area ? `${area.name} – ${division.name}` : division.name}
                      </span>
                    )}
                    <span className="text-slate-500 w-28 shrink-0 truncate">{m.match_title}</span>
                    <span className="flex-1 text-right truncate">{m.team_a_name}</span>
                    <span className="px-2 text-slate-500">vs</span>
                    <span className="flex-1 truncate">{m.team_b_name}</span>
                  </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
