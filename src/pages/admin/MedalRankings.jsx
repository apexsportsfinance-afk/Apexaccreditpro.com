import React, { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../../lib/supabase";
import { EventsAPI } from "../../lib/storage";
import { 
  Trophy, 
  MapPin, 
  Users, 
  RefreshCw,
  TrendingUp,
  Medal,
  ChevronRight,
  User,
  ShieldIcon,
  Search,
  X,
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../contexts/AuthContext";

export default function MedalRankings() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedCompetition, setSelectedCompetition] = useState("All");
  const [selectedGender, setSelectedGender] = useState("All");
  const [selectedClub, setSelectedClub] = useState("All");
  const [selectedAgeGroup, setSelectedAgeGroup] = useState("All");
  const [selectedEvent, setSelectedEvent] = useState("All");
  const [activeTab, setActiveTab] = useState("overall"); 
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [compNameInput, setCompNameInput] = useState("");
  const [liveEvents, setLiveEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [clearConfirming, setClearConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);
  const clearTimerRef = useRef(null);
  
  const toast = useToast();
  const { canAccessEvent, isSuperAdmin } = useAuth();
  const fileInputRef = useRef(null);

  const handleClearAllData = async () => {
    if (!clearConfirming) {
      setClearConfirming(true);
      clearTimerRef.current = setTimeout(() => setClearConfirming(false), 3500);
      return;
    }
    // Second click — confirmed
    clearTimeout(clearTimerRef.current);
    setClearConfirming(false);
    setClearing(true);
    try {
      const { error } = await supabase.from("medal_results").delete().not("id", "is", null);
      if (error) throw error;
      toast.success("All medal data has been cleared.");
      fetchResults();
    } catch (err) {
      console.error(err);
      toast.error("Failed to clear data. Please try again.");
    } finally {
      setClearing(false);
    }
  };

  useEffect(() => {
    fetchResults();
    fetchLiveEvents();
  }, []);

  const fetchLiveEvents = async () => {
    setEventsLoading(true);
    try {
      const events = await EventsAPI.getAll();
      const filtered = events.filter(e => canAccessEvent(e.id));
      setLiveEvents(filtered || []);
    } catch (err) {
      console.error("Failed to fetch events:", err);
    } finally {
      setEventsLoading(false);
    }
  };

  const fetchResults = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("medal_results")
      .select("*")
      .order("competition", { ascending: false });

    if (!error && data) {
      if (isSuperAdmin) {
        setResults(data);
      } else {
        // Filter results by accessible event names
        const accessibleEventNames = liveEvents.map(e => e.name);
        if (accessibleEventNames.length === 0) {
           // If liveEvents not loaded yet, we might need to wait or load them here
           // But actually, fetchLiveEvents runs at same time.
           // Better to filter in a separate effect or useMemo if possible, 
           // but setResults is direct.
           // Let's ensure we have accessible event names.
           const allEvents = await EventsAPI.getAll();
           const myEvents = allEvents.filter(e => canAccessEvent(e.id));
           const myNames = myEvents.map(e => e.name);
           setResults(data.filter(r => myNames.includes(r.competition)));
        } else {
           setResults(data.filter(r => accessibleEventNames.includes(r.competition)));
        }
      }
    }
    setLoading(false);
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    if (!compNameInput.trim()) {
      toast.error("Please enter a competition name first.");
      return;
    }

    setProcessing(true);
    try {
      const formData = new FormData();
      formData.append("competition_name", compNameInput);
      files.forEach(file => formData.append("files", file));

      // 1. Send to Python Bridge (Proxied via Node/Vite for robustness)
      console.log("Sending to results bridge...");
      const API_URL = "/api/bridge/results";

      const response = await fetch(API_URL, {
        method: "POST",
        body: formData
      });

      if (!response.ok) throw new Error("Could not connect to Python Bridge.");
      
      const data = await response.json();
      if (!data.success || data.results.length === 0) {
        toast.error("No results found in PDF files.");
        return;
      }

      // 2. Deduplicate: Check for existing medals in this specific competition
      console.log(`Checking for existing medals for "${compNameInput}"...`);
      const { data: existingMedals } = await supabase
        .from("medal_results")
        .select("swimmer_name, event_name")
        .eq("competition", compNameInput);

      const existingSet = new Set((existingMedals || []).map(m => 
        `${m.swimmer_name.trim().toLowerCase()}|${m.event_name.trim().toLowerCase()}`
      ));

      // Filter out only what's already in the DB
      const newMedals = data.results.filter(r => 
        !existingSet.has(`${r.swimmer_name.trim().toLowerCase()}|${r.event_name.trim().toLowerCase()}`)
      );

      if (newMedals.length === 0) {
        toast.show("No New Data", "All medals in this file are already recorded for this competition.", "info");
        setIsUploadModalOpen(false);
        setProcessing(false);
        return;
      }

      console.log(`Saving ${newMedals.length} fresh medals out of ${data.results.length}...`);
      const { error: upsertError } = await supabase.from("medal_results").insert(newMedals);
      if (upsertError) throw upsertError;

      toast.success(`Successfully added ${newMedals.length} new medals! (${data.results.length - newMedals.length} duplicates skipped)`);
      fetchResults();
      setIsUploadModalOpen(false);
      setCompNameInput("");
    } catch (err) {
      console.error(err);
      toast.error("Bridge Error: Make sure scripts/medal_api.py is running!");
    } finally {
      setProcessing(false);
    }
  };  // Helper to extract clean data
  const processedResults = useMemo(() => {
    return results.map(r => {
      // Split "10 Year Olds 100 LC Meter Butterfly" -> ["10 Year Olds", "100 LC Meter Butterfly"]
      const ageMatch = r.age_group.match(/^(\d+\s*&\s*Over|\d+\s*-\s*\d+|\d+\s*Year\s*Olds)/i);
      const ageCategory = ageMatch ? ageMatch[1] : r.age_group;
      const eventName = r.age_group.replace(ageCategory, "").trim() || r.event_name;
      
      return { ...r, ageCategory, eventName };
    });
  }, [results]);

  const competitions = useMemo(() => ["All", ...new Set(processedResults.map(r => r.competition))], [processedResults]);
  const clubs = useMemo(() => ["All", ...new Set(processedResults.map(r => r.team))], [processedResults]);

  const ageGroups = useMemo(() => {
    const subset = processedResults.filter(r => 
      (selectedEvent === "All" || r.eventName === selectedEvent) &&
      (selectedCompetition === "All" || r.competition === selectedCompetition) &&
      (selectedGender === "All" || r.gender === selectedGender)
    );
    const sortedCategories = [...new Set(subset.map(r => r.ageCategory))].sort((a,b) => {
      return (parseInt(a.match(/\d+/)) || 0) - (parseInt(b.match(/\d+/)) || 0);
    });
    return ["All", ...sortedCategories];
  }, [processedResults, selectedEvent, selectedCompetition, selectedGender]);

  const allEvents = useMemo(() => {
    const subset = processedResults.filter(r => 
      (selectedAgeGroup === "All" || r.ageCategory === selectedAgeGroup) &&
      (selectedCompetition === "All" || r.competition === selectedCompetition) &&
      (selectedGender === "All" || r.gender === selectedGender)
    );
    return ["All", ...new Set(subset.map(r => r.eventName))].sort();
  }, [processedResults, selectedAgeGroup, selectedCompetition, selectedGender]);

  const handleResetFilters = () => {
    setSelectedCompetition("All");
    setSelectedGender("All");
    setSelectedClub("All");
    setSelectedAgeGroup("All");
    setSelectedEvent("All");
    setActiveTab("overall");
  };

  const filteredResults = useMemo(() => {
    return processedResults.filter(r => {
      const matchComp = selectedCompetition === "All" || r.competition === selectedCompetition;
      const matchGender = selectedGender === "All" || r.gender === selectedGender;
      const matchClub = selectedClub === "All" || r.team === selectedClub;
      const matchAge = selectedAgeGroup === "All" || r.ageCategory === selectedAgeGroup;
      const matchEvent = selectedEvent === "All" || r.eventName === selectedEvent;
      const matchType = activeTab === "overall" || 
                        (activeTab === "individual" && r.event_type === "individual") ||
                        (activeTab === "relay" && r.event_type === "relay");
      return matchComp && matchGender && matchClub && matchAge && matchEvent && matchType;
    });
  }, [processedResults, selectedCompetition, selectedGender, selectedClub, selectedAgeGroup, selectedEvent, activeTab]);
;

  const rankings = useMemo(() => {
    const swimmerMedals = {};
    filteredResults.forEach(r => {
      const key = `${r.swimmer_name}-${r.team}`;
      if (!swimmerMedals[key]) {
        swimmerMedals[key] = { 
          name: r.swimmer_name, 
          team: r.team, 
          gender: r.gender,
          gold: 0, silver: 0, bronze: 0 
        };
      }
      if (r.place === 1) swimmerMedals[key].gold++;
      else if (r.place === 2) swimmerMedals[key].silver++;
      else if (r.place === 3) swimmerMedals[key].bronze++;
    });

    return Object.values(swimmerMedals)
      .sort((a, b) => {
        if (b.gold !== a.gold) return b.gold - a.gold;
        if (b.silver !== a.silver) return b.silver - a.silver;
        if (b.bronze !== a.bronze) return b.bronze - a.bronze;
        return a.name.localeCompare(b.name);
      });
  }, [filteredResults]);

  const totals = useMemo(() => {
    return rankings.reduce((acc, curr) => {
      acc.gold += curr.gold;
      acc.silver += curr.silver;
      acc.bronze += curr.bronze;
      acc.total += (curr.gold + curr.silver + curr.bronze);
      return acc;
    }, { gold: 0, silver: 0, bronze: 0, total: 0 });
  }, [rankings]);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="bg-base border border-white/5 rounded-3xl p-6 lg:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary-500/5 rounded-full blur-[100px] -mr-40 -mt-40" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary-500/20 rotate-3 transition-transform hover:scale-110 duration-500 cursor-pointer">
              <Trophy className="w-7 h-7 text-white stroke-[2.5px]" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-main tracking-tighter uppercase italic">
                Medal Rankings
              </h1>
              <p className="text-muted font-black uppercase tracking-widest text-xs mt-1 opacity-70">
                Real-time accomplishments leaderboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={handleClearAllData}
              disabled={clearing}
              className={cn(
                "px-4 py-3 font-bold rounded-2xl transition-all flex items-center gap-2 active:scale-95 border text-sm",
                clearConfirming
                  ? "bg-red-500/20 border-red-500/50 text-red-600 dark:text-red-400 hover:bg-red-500/30"
                  : "bg-base-alt border-border text-muted hover:bg-border hover:text-red-600 dark:hover:text-red-400"
              )}
            >
              {clearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {clearConfirming ? "Confirm Delete?" : "Clear Data"}
            </button>
            <button 
              onClick={() => setIsUploadModalOpen(true)}
              className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-base font-bold rounded-2xl transition-all flex items-center gap-2 shadow-lg shadow-primary-500/20 active:scale-95"
            >
              <Upload className="w-5 h-5" />
              Upload Results
            </button>
            <button 
              onClick={fetchResults}
              className="p-3 bg-base-alt hover:bg-border border border-border rounded-2xl text-muted hover:text-main transition-all active:scale-95"
            >
              <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {/* ... stats cards (same as before) ... */}
        <div className="bg-base border border-border rounded-2xl p-5 group hover:border-primary-500/30 transition-all shadow-xl">
           <div className="flex items-center gap-4 mb-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-600 dark:text-yellow-500">
                <Medal className="w-5 h-5" />
              </div>
              <span className="text-muted text-[10px] font-black uppercase tracking-widest opacity-80">Total Gold</span>
           </div>
           <div className="text-3xl font-black text-main tracking-tight">{totals.gold}</div>
        </div>
        <div className="bg-base border border-border rounded-2xl p-5 group hover:border-primary-500/30 transition-all shadow-xl">
           <div className="flex items-center gap-4 mb-3">
              <div className="w-10 h-10 rounded-xl bg-slate-400/10 flex items-center justify-center text-slate-600 dark:text-slate-400">
                <Medal className="w-5 h-5" />
              </div>
              <span className="text-muted text-[10px] font-black uppercase tracking-widest opacity-80">Total Silver</span>
           </div>
           <div className="text-3xl font-black text-main tracking-tight">{totals.silver}</div>
        </div>
        <div className="bg-base border border-border rounded-2xl p-5 group hover:border-primary-500/30 transition-all shadow-xl">
           <div className="flex items-center gap-4 mb-3">
              <div className="w-10 h-10 rounded-xl bg-orange-700/10 flex items-center justify-center text-orange-800 dark:text-orange-700">
                <Medal className="w-5 h-5" />
              </div>
              <span className="text-muted text-[10px] font-black uppercase tracking-widest opacity-80">Total Bronze</span>
           </div>
           <div className="text-3xl font-black text-main tracking-tight">{totals.bronze}</div>
        </div>
        <div className="bg-base border border-border rounded-2xl p-5 group hover:border-primary-500/30 transition-all shadow-xl">
           <div className="flex items-center gap-4 mb-3">
              <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center text-primary-600 dark:text-primary-500">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="text-muted text-[10px] font-black uppercase tracking-widest opacity-80">Grand Total</span>
           </div>
           <div className="text-3xl font-black text-main tracking-tight">{totals.total}</div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-base border border-white/5 rounded-3xl overflow-hidden shadow-2xl relative">
        {/* Table Filters (same as before) */}
        <div className="p-6 border-b border-white/5 flex flex-wrap items-center gap-4 bg-white/[0.01]">
          {/* ... filter selects ... */}
          <div className="flex-1 min-w-[200px]">
             <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-primary-500 transition-colors pointer-events-none" />
                <select 
                  value={selectedCompetition}
                  onChange={(e) => setSelectedCompetition(e.target.value)}
                  className="w-full bg-base-alt border border-border rounded-xl pl-10 pr-10 py-2.5 text-main font-medium hover:bg-border focus:border-primary-500/50 outline-none transition-all appearance-none"
                >
                  <option value="All" className="bg-base">All Competitions</option>
                  {competitions.filter(c => c !== "All").map(c => (
                    <option key={c} value={c} className="bg-base">{c}</option>
                  ))}
                </select>
                {selectedCompetition !== "All" && (
                  <button 
                    onClick={() => setSelectedCompetition("All")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-border rounded-lg text-muted hover:text-main transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
             </div>
          </div>

          <div className="flex-1 min-w-[200px]">
             <div className="relative">
                <select 
                  value={selectedClub}
                  onChange={(e) => setSelectedClub(e.target.value)}
                  className="w-full bg-base-alt border border-border rounded-xl px-4 py-2.5 text-main font-medium hover:bg-border focus:border-primary-500/50 outline-none transition-all appearance-none"
                >
                  <option value="All" className="bg-base">All Clubs / Teams</option>
                  {clubs.filter(c => c !== "All").map(c => (
                    <option key={c} value={c} className="bg-base">{c}</option>
                  ))}
                </select>
                {selectedClub !== "All" && (
                  <button 
                    onClick={() => setSelectedClub("All")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-border rounded-lg text-muted hover:text-main transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
             </div>
          </div>

          <div className="flex-1 min-w-[180px]">
             <div className="relative">
                <select 
                  value={selectedAgeGroup}
                  onChange={(e) => setSelectedAgeGroup(e.target.value)}
                  className="w-full bg-base-alt border border-border rounded-xl px-4 py-2.5 text-main font-medium hover:bg-border focus:border-primary-500/50 outline-none transition-all appearance-none"
                >
                  <option value="All" className="bg-base">All Ages</option>
                  {ageGroups.filter(a => a !== "All").map(a => (
                    <option key={a} value={a} className="bg-base">{a}</option>
                  ))}
                </select>
                {selectedAgeGroup !== "All" && (
                  <button 
                    onClick={() => setSelectedAgeGroup("All")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-border rounded-lg text-muted hover:text-main transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
             </div>
          </div>

          <div className="flex-1 min-w-[200px]">
             <div className="relative">
                <select 
                  value={selectedEvent}
                  onChange={(e) => setSelectedEvent(e.target.value)}
                  className="w-full bg-base-alt border border-border rounded-xl px-4 py-2.5 text-main font-medium hover:bg-border focus:border-primary-500/50 outline-none transition-all appearance-none"
                >
                  <option value="All" className="bg-base">All Events</option>
                  {allEvents.filter(a => a !== "All").map(a => (
                    <option key={a} value={a} className="bg-base">{a}</option>
                  ))}
                </select>
                {selectedEvent !== "All" && (
                  <button 
                    onClick={() => setSelectedEvent("All")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-border rounded-lg text-muted hover:text-main transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
             </div>
          </div>

          <div className="flex bg-base-alt border border-border rounded-xl p-1">
             {["All", "Boys", "Girls"].map(g => (
                <button
                  key={g}
                  onClick={() => setSelectedGender(g)}
                  className={cn(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                    selectedGender === g ? "bg-primary-500 text-white shadow-lg shadow-primary-500/20" : "text-muted hover:text-main"
                  )}
                >
                  {g}
                </button>
             ))}
          </div>

          <button
            onClick={handleResetFilters}
            className="p-3 bg-base-alt border border-border rounded-xl text-muted hover:text-primary-500 hover:bg-border transition-all group"
            title="Reset Filters"
          >
            <RefreshCw className="w-5 h-5 group-active:rotate-180 transition-transform duration-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border px-6 pt-2">
           {[
             { id: "overall", label: "Grand Rankings", icon: Trophy },
             { id: "individual", label: "Individual", icon: User },
             { id: "relay", label: "Relay Events", icon: Users }
           ].map(tab => (
             <button
               key={tab.id}
               onClick={() => setActiveTab(tab.id)}
               className={cn(
                 "flex items-center gap-2 px-6 py-4 text-sm font-bold tracking-wide relative transition-all",
                 activeTab === tab.id ? "text-primary-500" : "text-muted hover:text-main"
               )}
             >
               <tab.icon className="w-4 h-4" />
               {tab.label}
               {activeTab === tab.id && (
                 <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary-500 shadow-glow" />
               )}
             </button>
           ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-main/[0.02] border-b border-border">
                <th className="px-6 py-5 text-[10px] font-black text-muted uppercase tracking-[0.2em] min-w-[70px]">Rank</th>
                <th className="px-6 py-5 text-[10px] font-black text-muted uppercase tracking-[0.2em]">Swimmer Details</th>
                <th className="px-6 py-5 text-[10px] font-black text-muted uppercase tracking-[0.2em]">Academy</th>
                <th className="px-6 py-5 text-[10px] font-black text-muted uppercase tracking-[0.2em] text-center">🥇 Gold</th>
                <th className="px-6 py-5 text-[10px] font-black text-muted uppercase tracking-[0.2em] text-center">🥈 Silver</th>
                <th className="px-6 py-5 text-[10px] font-black text-muted uppercase tracking-[0.2em] text-center">🥉 Bronze</th>
                <th className="px-6 py-5 text-[10px] font-black text-muted uppercase tracking-[0.2em] text-center">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rankings.map((r, i) => (
                <tr key={i} className="group hover:bg-main/[0.02] transition-colors border-b border-border/50">
                  <td className="px-6 py-4">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm",
                      i === 0 ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-500 ring-1 ring-yellow-500/50 shadow-lg shadow-yellow-500/10" :
                      i === 1 ? "bg-slate-400/20 text-slate-600 dark:text-slate-400 ring-1 ring-slate-400/50" :
                      i === 2 ? "bg-orange-700/20 text-orange-800 dark:text-orange-700 ring-1 ring-orange-700/50" :
                      "text-muted"
                    )}>
                      {i + 1}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-base border border-border flex items-center justify-center text-primary-500 font-bold text-sm ring-1 ring-border shadow-inner">
                        {r.name[0]}
                      </div>
                      <div>
                        {/* FIX: athlete name visibility issue */}
                        <div className="text-sm font-black text-main group-hover:text-primary-500 transition-colors uppercase tracking-tight">{r.name}</div>
                        <div className="text-[10px] text-muted font-black uppercase tracking-widest opacity-60">{r.gender}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-muted text-sm font-medium">
                      <MapPin className="w-3.5 h-3.5 text-muted/50" />
                      {r.team}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center font-bold text-main text-base">{r.gold}</td>
                  <td className="px-6 py-4 text-center font-bold text-main text-base">{r.silver}</td>
                  <td className="px-6 py-4 text-center font-bold text-main text-base">{r.bronze}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center">
                      <div className="px-4 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-600 dark:text-primary-500 font-black text-sm tracking-tighter">
                        {r.gold + r.silver + r.bronze}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              
              {/* Grand Total Row */}
              {rankings.length > 0 && (
                <tr className="bg-primary-500/5 border-t border-primary-500/20">
                   <td colSpan={3} className="px-6 py-6 font-black tracking-[0.2em] uppercase text-xs text-primary-500 opacity-80">
                      <div className="flex items-center gap-4">
                         <ShieldIcon className="w-5 h-5 transform-gpu transition-transform hover:scale-125 duration-500" />
                         Final Achievement Summary
                      </div>
                   </td>
                   <td className="px-6 py-6 text-center font-black text-main text-xl">{totals.gold}</td>
                   <td className="px-6 py-6 text-center font-black text-main text-xl">{totals.silver}</td>
                   <td className="px-6 py-6 text-center font-black text-main text-xl">{totals.bronze}</td>
                   <td className="px-6 py-6 text-center">
                      <div className="inline-block px-5 py-2 rounded-xl bg-primary-500/20 border border-primary-500/50 font-black text-primary-600 dark:text-primary-500 text-2xl tracking-tighter shadow-glow pointer-events-none">
                        {totals.total}
                      </div>
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {rankings.length === 0 && !loading && (
          <div className="py-24 flex flex-col items-center justify-center opacity-40 grayscale animate-pulse">
             <Medal className="w-20 h-20 text-slate-700 mb-6" />
             <p className="text-2xl font-bold tracking-tight text-white mb-2 uppercase italic">No Achievements Logged</p>
             <p className="text-slate-400 font-medium tracking-widest text-xs uppercase">Click 'Upload Results' to start processing</p>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
           <div 
             className="absolute inset-0 bg-base/90 backdrop-blur-xl transition-all"
             onClick={() => !processing && setIsUploadModalOpen(false)}
           />
           <div className="bg-base border border-border rounded-[2.5rem] p-8 lg:p-12 w-full max-w-2xl relative z-10 shadow-[0_0_100px_rgba(34,211,238,0.1)]">
              <button 
                onClick={() => !processing && setIsUploadModalOpen(false)}
                className="absolute top-8 right-8 p-2 rounded-xl hover:bg-base-alt text-muted hover:text-main transition-all shadow-lg"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="text-center mb-10">
                 <div className="w-20 h-20 bg-primary-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 text-primary-500 shadow-xl shadow-primary-500/10 ring-1 ring-primary-500/20 overflow-hidden">
                    <div className="relative w-full h-full flex items-center justify-center">
                       <Upload className={cn("w-10 h-10 transition-transform duration-700", processing ? "translate-y-[-100%]" : "translate-y-0")} />
                       {processing && <Loader2 className="w-10 h-10 absolute animate-spin" />}
                    </div>
                 </div>
                 <h2 className="text-4xl font-bold text-main tracking-tight mb-2">Import Meet Results</h2>
                 <p className="text-muted font-medium max-w-xs mx-auto">Upload your HY-TEK PDF results to sync accomplishments instantly.</p>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-xs font-black text-muted uppercase tracking-[0.3em] mb-3 block ml-1">Select Event</label>
                  <div className="relative">
                    <select
                      value={compNameInput}
                      onChange={(e) => setCompNameInput(e.target.value)}
                      disabled={eventsLoading || processing}
                      className="w-full bg-base-alt border border-border rounded-2xl px-6 py-4 text-main font-bold focus:border-primary-500/50 outline-none transition-all shadow-inner appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="" className="bg-base text-muted">
                        {eventsLoading ? "Loading events..." : liveEvents.length === 0 ? "No events found" : "— Select an event —"}
                      </option>
                      {liveEvents.map((ev) => (
                        <option key={ev.id} value={ev.name} className="bg-base text-main">
                          {ev.name}
                        </option>
                      ))}
                    </select>
                    <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted rotate-90 pointer-events-none" />
                  </div>
                </div>

                <div 
                  className={cn(
                    "border-2 border-dashed border-border rounded-[2rem] p-12 text-center transition-all bg-main/[0.02] relative overflow-hidden group cursor-pointer",
                    !processing ? "hover:border-primary-500/50 hover:bg-primary-500/5" : "opacity-75 cursor-not-allowed"
                  )}
                  onClick={() => !processing && fileInputRef.current?.click()}
                >
                  {processing ? (
                    <div className="flex flex-col items-center gap-6">
                      <div className="w-16 h-16 rounded-full border-4 border-primary-500/20 border-t-primary-500 animate-spin" />
                      <div className="space-y-1">
                         <p className="text-xl font-bold text-main tracking-tight">Processing PDFs...</p>
                         <p className="text-muted text-sm font-medium tracking-wide">Python Engine is reading your tables</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                       <div className="flex justify-center -space-x-3 mb-2">
                          <div className="w-12 h-12 rounded-2xl bg-base border border-white/10 flex items-center justify-center text-slate-500 -rotate-12 transition-transform group-hover:-translate-y-2">
                            <FileText className="w-6 h-6" />
                          </div>
                          <div className="w-12 h-12 rounded-2xl bg-primary-500 flex items-center justify-center text-base z-10 shadow-2xl transition-transform group-hover:-translate-y-4">
                            <Medal className="w-6 h-6" />
                          </div>
                          <div className="w-12 h-12 rounded-2xl bg-base border border-white/10 flex items-center justify-center text-slate-500 rotate-12 transition-transform group-hover:-translate-y-2">
                            <Trophy className="w-6 h-6" />
                          </div>
                       </div>
                       <p className="text-lg font-bold text-white tracking-tight">Click or Drag PDF Result File</p>
                       <p className="text-xs text-slate-500 font-bold uppercase tracking-[0.3em]">HY-TEK MEET MANAGER FORMAT</p>
                    </div>
                  )}
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept=".pdf" 
                    multiple
                    className="hidden" 
                    disabled={processing}
                    onChange={handleFileUpload}
                  />
                </div>
              </div>

              <div className="mt-8 flex items-start gap-4 p-5 bg-primary-500/5 border border-primary-500/10 rounded-3xl">
                 <AlertCircle className="w-6 h-6 text-primary-500 flex-shrink-0 mt-0.5" />
                 <p className="text-sm text-muted font-medium leading-relaxed">
                    This tool uses a robust **Python Parsing Engine** to identify **🥇 🥈 🥉 winners** with 100% accuracy. Please ensure `scripts/medal_api.py` is running.
                 </p>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
