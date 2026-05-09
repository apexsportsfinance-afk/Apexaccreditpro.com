import React, { useState, useEffect, useMemo } from "react";
import { 
  Search, 
  Activity, 
  Download, 
  Filter, 
  ChevronDown,
  MapPin,
  Clock,
  Radio,
  Zap,
  Layout
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AttendanceAPI } from "../../../lib/attendanceApi";
import { AccreditationsAPI } from "../../../lib/storage";
import { useToast } from "../../../components/ui/Toast";
import Button from "../../../components/ui/Button";
import { supabase } from "../../../lib/supabase";

export default function AuditLogView({ event }) {
  const [logs, setLogs] = useState([]);
  const [zones, setZones] = useState([]);
  const [accreditations, setAccreditations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedArea, setSelectedArea] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [viewMode, setViewMode] = useState("ledger"); 
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isSyncing, setIsSyncing] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (event?.id) {
      loadLogs();
      loadZones();
      const interval = setInterval(() => {
        silentRefresh();
      }, 60000);
      return () => clearInterval(interval);
    }
  }, [event?.id]);

  const silentRefresh = async () => {
    setIsSyncing(true);
    try {
      const [logsData, accsData] = await Promise.all([
        AttendanceAPI.getScanLogsByEvent(event.id, 2000),
        AccreditationsAPI.getByEventId(event.id, { status: "approved" })
      ]);
      setLogs(logsData || []);
      setAccreditations(accsData || []);
      setLastUpdated(new Date());
      
      const { data } = await supabase
        .from("zones")
        .select("code, name")
        .eq("event_id", event.id)
        .order("code");
      if (data) setZones(data);
    } catch (err) {
      console.error("Silent refresh error:", err);
    } finally {
      setTimeout(() => setIsSyncing(false), 1000);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    try {
      const [logsData, accsData] = await Promise.all([
        AttendanceAPI.getScanLogsByEvent(event.id, 2000),
        AccreditationsAPI.getByEventId(event.id, { status: "approved" })
      ]);
      setLogs(logsData || []);
      setAccreditations(accsData || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Error loading ledger data:", err);
      toast.error("Failed to load scanner logs");
    } finally {
      setLoading(false);
    }
  };

  const loadZones = async () => {
    try {
      const { data, error } = await supabase
        .from("zones")
        .select("code, name")
        .eq("event_id", event.id)
        .order("code");
      if (error) throw error;
      setZones(data || []);
    } catch (err) {
      console.error("Error loading zones:", err);
    }
  };

  const availableDates = useMemo(() => {
    const dates = new Set();
    logs.forEach(log => {
      const date = new Date(log.created_at).toISOString().split('T')[0];
      dates.add(date);
    });
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [logs]);

  const areaSummary = useMemo(() => {
    const summary = {};
    const getCanonicalName = (z) => `${z.name} (${z.code})`;
    zones.forEach(z => {
      const allocatedCount = accreditations.filter(acc => 
        acc.zoneCode === z.code || (acc.zoneCode && acc.zoneCode.includes(z.code))
      ).length;
      summary[getCanonicalName(z)] = { scanned: new Set(), allocated: allocatedCount, code: z.code };
    });
    logs.forEach(log => {
      const logDate = new Date(log.created_at).toISOString().split('T')[0];
      if (dateFilter !== "all" && logDate !== dateFilter) return;
      let areaName = log.device_label || 'Other';
      if (!summary[areaName]) {
        const matchingZone = zones.find(z => areaName === z.name || areaName === `${z.name} (${z.code})` || (z.code && areaName.includes(`(${z.code})`)));
        if (matchingZone) areaName = getCanonicalName(matchingZone);
      }
      log.resolved_area = areaName;
      const isSystemDefault = areaName.toLowerCase().includes("self-scan") || areaName.toLowerCase() === "main entrance" || areaName.toLowerCase() === "unknown";
      if (!summary[areaName] && isSystemDefault) summary[areaName] = { scanned: new Set(), allocated: 0, code: null };
      if (summary[areaName] && log.athlete_id) summary[areaName].scanned.add(log.athlete_id);
    });
    return summary;
  }, [logs, zones, accreditations, dateFilter]);

  const GATE_SCAN_MODES = ["zone_check_in", "zone_check_out"];

  const presenceSummary = useMemo(() => {
    const summaryMap = {};
    const gateLogs = logs
      .filter(log => GATE_SCAN_MODES.includes(log.scan_mode))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    gateLogs.forEach(log => {
      const athleteId = log.athlete_id;
      if (!athleteId) return;
      const zoneName = log.device_label || "Unknown Zone";
      if (!summaryMap[athleteId]) {
        summaryMap[athleteId] = { athlete: log.accreditations, zones: {} };
      }
      const currentZone = summaryMap[athleteId].zones[zoneName] || { 
        status: "Never Entered", lastIn: null, lastOut: null, totalEntries: 0
      };
      if (log.scan_mode === "zone_check_in") {
        currentZone.status = "Inside";
        currentZone.lastIn = log.created_at;
        currentZone.totalEntries++;
      } else if (log.scan_mode === "zone_check_out") {
        currentZone.status = "Outside";
        currentZone.lastOut = log.created_at;
      }
      summaryMap[athleteId].zones[zoneName] = currentZone;
    });
    const flattened = [];
    Object.entries(summaryMap).forEach(([athleteId, data]) => {
      Object.entries(data.zones).forEach(([zoneName, stats]) => {
        flattened.push({ id: `${athleteId}-${zoneName}`, athlete: data.athlete, zone: zoneName, ...stats });
      });
    });
    return flattened;
  }, [logs]);

  const filteredPresence = useMemo(() => {
    return presenceSummary.filter(item => {
      const name = `${item.athlete?.first_name || ''} ${item.athlete?.last_name || ''}`.toLowerCase();
      const badge = (item.athlete?.badge_number || "").toLowerCase();
      const matchesSearch = name.includes(searchTerm.toLowerCase()) || badge.includes(searchTerm.toLowerCase());
      const matchesArea = selectedArea === "all" || item.zone.includes(selectedArea) || item.zone === selectedArea;
      return matchesSearch && matchesArea;
    });
  }, [presenceSummary, searchTerm, selectedArea]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const logDate = new Date(log.created_at).toISOString().split('T')[0];
      if (dateFilter !== "all" && logDate !== dateFilter) return false;
      const name = `${log.accreditations?.first_name || ''} ${log.accreditations?.last_name || ''}`.toLowerCase();
      const club = (log.accreditations?.club || "").toLowerCase();
      const badge = (log.accreditations?.badge_number || "").toLowerCase();
      const matchesSearch = name.includes(searchTerm.toLowerCase()) || 
                           club.includes(searchTerm.toLowerCase()) ||
                           badge.includes(searchTerm.toLowerCase());
      const matchesArea = selectedArea === "all" || (log.resolved_area === selectedArea);
      return matchesSearch && matchesArea;
    });
  }, [logs, searchTerm, selectedArea, dateFilter]);

  const totalUniqueScanned = useMemo(() => {
    const unique = new Set();
    logs.forEach(log => {
      const logDate = new Date(log.created_at).toISOString().split('T')[0];
      if (dateFilter !== "all" && logDate !== dateFilter) return;
      if (log.athlete_id) unique.add(log.athlete_id);
    });
    return unique.size;
  }, [logs, dateFilter]);

  const exportToExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const logExport = filteredLogs.map(log => ({
        'Scan Time': new Date(log.created_at).toLocaleString(),
        'Participant': `${log.accreditations?.first_name || 'Guest'} ${log.accreditations?.last_name || ''}`,
        'Badge #': log.accreditations?.badge_number || 'N/A',
        'Mode': log.scan_mode?.replace('zone_', '').toUpperCase() || 'SCAN',
        'Location': log.device_label || 'Main Entrance'
      }));
      const presenceExport = filteredPresence.map(item => ({
        'Participant': `${item.athlete?.first_name} ${item.athlete?.last_name}`,
        'Badge #': item.athlete?.badge_number,
        'Zone': item.zone,
        'Current Status': item.status,
        'Last Entry': item.lastIn ? new Date(item.lastIn).toLocaleString() : 'N/A',
        'Last Exit': item.lastOut ? new Date(item.lastOut).toLocaleString() : 'N/A',
        'Total Visits Today': item.totalEntries
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(logExport), "Audit Logs");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(presenceExport), "Presence Summary");
      const fileName = `${event.slug}_audit_report_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success("Consolidated report exported successfully");
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Failed to export to Excel");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-10 pb-20 relative overflow-hidden"
    >
      {/* Global Scanning Sweep Animation */}
      <motion.div 
        animate={{ top: ['-10%', '110%'] }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary-500/20 to-transparent z-50 pointer-events-none"
      />
      <motion.div 
        animate={{ top: ['-10%', '110%'] }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear", delay: 4 }}
        className="absolute left-0 right-0 h-[100px] bg-gradient-to-b from-primary-500/[0.03] to-transparent z-40 pointer-events-none"
      />  <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary-500/5 rounded-full blur-[120px] pointer-events-none -z-10 animate-pulse" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
        <div className="space-y-4">
          <motion.div initial={{ x: -20 }} animate={{ x: 0 }} className="flex items-center gap-3">
            <div className="h-[1px] w-12 bg-gradient-to-r from-primary-500 to-transparent" />
            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary-400">Tactical Operations Center</span>
          </motion.div>
          <h1 className="text-5xl font-black text-white tracking-tighter uppercase leading-none">
            Scanner Audit <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 via-sky-400 to-emerald-400">Intelligence Ledger</span>
          </h1>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Live Network Link</span>
            </div>
            <div className="flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-primary-500 animate-pulse" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{logs.length} Total Logs Detected</span>
            </div>
          </div>
        </div>
        <motion.div whileHover={{ scale: 1.02 }} className="bg-black/40 backdrop-blur-3xl border border-white/10 p-1 rounded-[32px] shadow-2xl shadow-primary-500/10 min-w-[300px]">
          <div className="bg-gradient-to-br from-slate-900 to-black rounded-[31px] p-6 border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2.5 bg-primary-500/10 rounded-2xl border border-primary-500/20"><Activity className="w-5 h-5 text-primary-400" /></div>
              <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${isSyncing ? 'bg-primary-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                {isSyncing ? "Syncing..." : "Ready"}
              </div>
            </div>
            <div className="space-y-1 relative">
              <div className="absolute -right-2 top-0 flex gap-1 items-end h-8">
                {[...Array(5)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ height: [4, 12, 8, 16, 4][(i + Math.floor(lastUpdated.getSeconds()/10)) % 5] }}
                    transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.1 }}
                    className="w-1 bg-primary-500/40 rounded-full"
                  />
                ))}
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Last System Update</p>
              <p className="text-2xl font-mono font-black text-white tracking-tight tabular-nums">
                {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-5">
        <div className="relative group col-span-2 md:col-span-1 lg:col-span-1">
          <div className="absolute -inset-0.5 bg-gradient-to-b from-primary-500 to-ocean-500 rounded-3xl opacity-20 group-hover:opacity-40 transition duration-500 blur" />
          <div className="relative bg-[#0b1120] border border-white/5 p-5 rounded-[22px] h-full flex flex-col justify-between overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity"><Zap className="w-12 h-12 text-primary-500" /></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-primary-500/60 mb-1">Fleet Scans</p>
              <h3 className="text-4xl font-black text-white tracking-tighter">{totalUniqueScanned}</h3>
            </div>
            <div className="mt-4 pt-4 border-t border-white/5">
              <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: '70%' }} className="h-full bg-primary-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
              </div>
            </div>
          </div>
        </div>
        {Object.entries(areaSummary).map(([area, data], idx) => (
          <motion.div key={area} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }} className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-b from-emerald-500 to-teal-500 rounded-3xl opacity-10 group-hover:opacity-30 transition duration-500 blur" />
            <div className="relative bg-[#0b1120] border border-white/5 p-5 rounded-[22px] h-full flex flex-col justify-between overflow-hidden group-hover:border-emerald-500/20 transition-all">
              <div className="absolute top-0 right-0 p-2 opacity-5"><MapPin className="w-16 h-16 text-emerald-500" /></div>
              <div className="min-w-0">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2 truncate">{area.split(' (')[0]}</p>
                <div className="flex items-baseline gap-1 mb-3">
                  <h3 className="text-2xl font-black text-white tracking-tighter">{data.scanned.size}</h3>
                  <span className="text-[10px] font-bold text-slate-700">/ {data.allocated}</span>
                </div>
              </div>
              <div className="mt-auto">
                <div className="flex justify-between items-end mb-1.5">
                  <span className="text-[8px] font-black uppercase text-emerald-500/60 tracking-widest">Occupancy</span>
                  <span className="text-[9px] font-bold text-white">
                    {data.allocated > 0 ? `${Math.round((data.scanned.size / data.allocated) * 100)}%` : 'LIVE'}
                  </span>
                </div>
                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: data.allocated > 0 ? `${Math.min((data.scanned.size / data.allocated) * 100, 100)}%` : '100%' }}
                    className={`h-full ${data.allocated > 0 ? 'bg-emerald-500' : 'bg-primary-500/50'} shadow-[0_0_10px_rgba(16,185,129,0.5)]`}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="bg-black/60 backdrop-blur-3xl border border-white/10 p-3 rounded-[32px] flex flex-col xl:flex-row gap-4 items-center shadow-2xl">
        <div className="flex bg-slate-900/50 rounded-2xl p-1.5 gap-1.5 border border-white/5 shadow-inner">
          <button onClick={() => setViewMode("ledger")} className={`flex items-center gap-3 px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${viewMode === 'ledger' ? 'bg-primary-600 text-white shadow-[0_0_30px_rgba(37,99,235,0.4)] scale-100' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5 scale-95'}`}>
            <Radio className={`w-4 h-4 ${viewMode === 'ledger' ? 'animate-pulse' : ''}`} /> Live Feed
          </button>
          <button onClick={() => setViewMode("presence")} className={`flex items-center gap-3 px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-500 ${viewMode === 'presence' ? 'bg-emerald-600 text-white shadow-[0_0_30px_rgba(5,150,105,0.4)] scale-100' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5 scale-95'}`}>
            <Layout className="w-4 h-4" /> Presence
          </button>
        </div>
        <div className="flex-1 flex flex-col md:flex-row gap-4 w-full">
          <div className="relative flex-1 group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-primary-400 transition-colors" />
            <input type="text" placeholder="QUICK SEARCH SUBJECT..." className="bg-black/20 border border-white/10 rounded-2xl pl-14 pr-6 py-4 text-xs font-black uppercase tracking-widest w-full text-white placeholder:text-slate-700 focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500/50 outline-none transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="relative min-w-[280px] group">
            <Filter className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500/40 group-focus-within:text-emerald-400 transition-colors" />
            <select className="bg-black/20 border border-white/10 text-slate-400 rounded-2xl pl-14 pr-12 py-4 text-[10px] font-black uppercase tracking-[0.2em] w-full focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 outline-none appearance-none cursor-pointer hover:bg-black/40 transition-all" value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)}>
              <option value="all">ALL SECURITY ZONES</option>
              {Object.keys(areaSummary).sort().map(a => (<option key={a} value={a}>{a.toUpperCase()}</option>))}
            </select>
            <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-700 pointer-events-none" />
          </div>
        </div>
        <Button icon={Download} onClick={exportToExcel} className="h-full px-10 py-4.5 rounded-2xl bg-white text-black font-black uppercase tracking-[0.2em] text-[10px] hover:bg-primary-400 hover:text-white transition-all duration-500 shadow-2xl">Export Intelligence</Button>
      </div>
      <div className="relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary-500/20 to-emerald-500/20 rounded-[40px] opacity-0 group-hover:opacity-100 transition duration-700 blur-xl pointer-events-none" />
        <div className="relative bg-[#050914] backdrop-blur-3xl border border-white/10 rounded-[40px] overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
          <div className="overflow-x-auto">
            {viewMode === "ledger" ? (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/10">
                    <th className="px-10 py-8 text-[9px] font-black text-slate-500 uppercase tracking-[0.5em]">Time Unit</th>
                    <th className="px-10 py-8 text-[9px] font-black text-slate-500 uppercase tracking-[0.5em]">Entity Profile</th>
                    <th className="px-10 py-8 text-[9px] font-black text-slate-500 uppercase tracking-[0.5em]">Security Key</th>
                    <th className="px-10 py-8 text-[9px] font-black text-slate-500 uppercase tracking-[0.5em] text-center">Status Op</th>
                    <th className="px-10 py-8 text-[9px] font-black text-slate-500 uppercase tracking-[0.5em]">Deployment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <AnimatePresence mode="popLayout">
                    {loading ? (
                      <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <td colSpan="5" className="py-48 text-center">
                          <div className="flex flex-col items-center gap-6">
                            <div className="relative">
                              <div className="w-16 h-16 border-4 border-primary-500/20 rounded-full" />
                              <div className="absolute inset-0 w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-primary-500 animate-pulse">Syncing Tactical Grid</p>
                          </div>
                        </td>
                      </motion.tr>
                    ) : filteredLogs.length === 0 ? (
                      <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <td colSpan="5" className="py-48 text-center text-slate-600 font-black uppercase tracking-widest text-[10px]">Zero Activity in Sector</td>
                      </motion.tr>
                    ) : (
                      filteredLogs.map((log, idx) => (
                        <motion.tr key={log.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.02, 0.4) }} className="hover:bg-white/[0.03] transition-all group/row border-l-4 border-l-transparent hover:border-l-primary-500">
                          <td className="px-10 py-7">
                            <div className="flex flex-col gap-1">
                              <span className="text-lg font-mono font-black text-white tracking-tighter tabular-nums">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>
                              <span className="text-[9px] text-slate-600 font-black uppercase tracking-[0.2em]">{new Date(log.created_at).toLocaleDateString()}</span>
                            </div>
                          </td>
                          <td className="px-10 py-7">
                            <div className="flex flex-col gap-0.5">
                              <p className="text-[13px] font-black text-white uppercase tracking-tight group-hover/row:text-primary-400 transition-colors">{log.accreditations ? `${log.accreditations.first_name} ${log.accreditations.last_name}` : 'Unknown Entity'}</p>
                              <p className="text-[9px] text-primary-500/50 font-black uppercase tracking-widest">Classification: {log.accreditations?.role || 'External'}</p>
                            </div>
                          </td>
                          <td className="px-10 py-7">
                            <span className="px-4 py-2 rounded-xl bg-black border border-white/5 text-[10px] font-mono font-black text-primary-400/80 shadow-inner group-hover/row:border-primary-500/30 transition-all">{log.accreditations?.badge_number || 'NULL_KEY'}</span>
                          </td>
                          <td className="px-10 py-7 text-center">
                            <div className={`px-5 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-[0.3em] inline-flex items-center gap-3 border shadow-2xl transition-all ${log.scan_mode === 'zone_check_in' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 group-hover/row:bg-emerald-500/20' : log.scan_mode === 'zone_check_out' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 group-hover/row:bg-amber-500/20' : 'bg-primary-500/10 text-primary-400 border-primary-500/30'}`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${log.scan_mode === 'zone_check_in' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                              {log.scan_mode?.replace('zone_', '').replace('_', ' ')}
                            </div>
                          </td>
                          <td className="px-10 py-7">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-white/5 rounded-lg"><MapPin className="w-3.5 h-3.5 text-slate-500" /></div>
                              <span className="text-[11px] text-slate-400 font-black uppercase tracking-widest">{log.device_label || 'CENTRAL HUB'}</span>
                            </div>
                          </td>
                        </motion.tr>
                      ))
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/[0.02] border-b border-white/10">
                    <th className="px-10 py-8 text-[9px] font-black text-slate-500 uppercase tracking-[0.5em]">Subject Profile</th>
                    <th className="px-10 py-8 text-[9px] font-black text-slate-500 uppercase tracking-[0.5em]">Zone Assignment</th>
                    <th className="px-10 py-8 text-[9px] font-black text-slate-500 uppercase tracking-[0.5em]">Presence Status</th>
                    <th className="px-10 py-8 text-[9px] font-black text-slate-500 uppercase tracking-[0.5em]">Last Ingress</th>
                    <th className="px-10 py-8 text-[9px] font-black text-slate-500 uppercase tracking-[0.5em]">Last Egress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  <AnimatePresence mode="popLayout">
                    {loading ? (
                      <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <td colSpan="5" className="py-48 text-center text-primary-500 font-black tracking-[0.4em] uppercase">Calculating Fleet Presence...</td>
                      </motion.tr>
                    ) : filteredPresence.length === 0 ? (
                      <motion.tr initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <td colSpan="5" className="py-48 text-center text-slate-600 font-black tracking-widest uppercase text-[10px]">Zero Presence Tracked</td>
                      </motion.tr>
                    ) : (
                      filteredPresence.map((p, idx) => (
                        <motion.tr key={p.id} layout initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(idx * 0.02, 0.4) }} className="hover:bg-white/[0.03] transition-all group/row">
                          <td className="px-10 py-7">
                            <div className="flex flex-col gap-1">
                              <p className="text-[13px] font-black text-white uppercase tracking-tight group-hover/row:text-primary-400 transition-colors">{p.athlete ? `${p.athlete.first_name} ${p.athlete.last_name}` : 'Unknown Subject'}</p>
                              <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest font-mono">KEY: {p.athlete?.badge_number || '---'}</p>
                            </div>
                          </td>
                          <td className="px-10 py-7"><span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{p.zone}</span></td>
                          <td className="px-10 py-7">
                            <div className={`px-5 py-2.5 rounded-full text-[9px] font-black uppercase tracking-[0.3em] inline-flex items-center gap-3 border transition-all ${p.status === 'Inside' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'bg-slate-900 text-slate-600 border-white/5'}`}>
                              <div className={`w-2 h-2 rounded-full ${p.status === 'Inside' ? 'bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,1)]' : 'bg-slate-700'}`} />
                              {p.status}
                            </div>
                          </td>
                          <td className="px-10 py-7"><p className="text-lg font-mono font-black text-slate-300 tabular-nums tracking-tighter">{p.lastIn ? new Date(p.lastIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '---'}</p></td>
                          <td className="px-10 py-7"><p className="text-lg font-mono font-black text-slate-700 tabular-nums tracking-tighter italic">{p.lastOut ? new Date(p.lastOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '---'}</p></td>
                        </motion.tr>
                      ))
                    )}
                  </AnimatePresence>
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
