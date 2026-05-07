import React, { useState, useEffect, useMemo } from "react";
import { 
  Search, 
  Activity, 
  Download, 
  Filter, 
  Trophy,
  Users,
  ChevronDown,
  MapPin
} from "lucide-react";
import { AttendanceAPI } from "../../../lib/attendanceApi";
import { AccreditationsAPI } from "../../../lib/storage";
import { useToast } from "../../../components/ui/Toast";
import Button from "../../../components/ui/Button";
import { supabase } from "../../../lib/supabase";
import { Calendar } from "lucide-react";

export default function AuditLogView({ event }) {
  const [logs, setLogs] = useState([]);
  const [zones, setZones] = useState([]);
  const [accreditations, setAccreditations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedArea, setSelectedArea] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [viewMode, setViewMode] = useState("ledger"); // 'ledger' or 'presence'
  const toast = useToast();

  useEffect(() => {
    if (event?.id) {
      loadLogs();
      loadZones();
    }
  }, [event?.id]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const [logsData, accsData] = await Promise.all([
        AttendanceAPI.getScanLogsByEvent(event.id, 2000),
        AccreditationsAPI.getByEventId(event.id, { status: "approved" })
      ]);
      setLogs(logsData || []);
      setAccreditations(accsData || []);
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

  // Available dates for filtering
  const availableDates = useMemo(() => {
    const dates = new Set();
    logs.forEach(log => {
      const date = new Date(log.created_at).toISOString().split('T')[0];
      dates.add(date);
    });
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [logs]);

  // Requirement: Summarize ALL areas with Allocation Ratios
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

  // Summarize by Sport with Allocation Ratios
  const sportSummary = useMemo(() => {
    const summary = {};
    const sports = event.sportList || ["Swimming"];
    sports.forEach(s => { 
      const allocated = accreditations.filter(acc => acc.selectedSports && acc.selectedSports.includes(s)).length;
      summary[s] = { scanned: new Set(), allocated }; 
    });
    logs.forEach(log => {
      const logDate = new Date(log.created_at).toISOString().split('T')[0];
      if (dateFilter !== "all" && logDate !== dateFilter) return;
      const athleteSports = log.accreditations?.selected_sports || [];
      athleteSports.forEach(s => {
        if (summary[s] && log.athlete_id) summary[s].scanned.add(log.athlete_id);
      });
    });
    return summary;
  }, [logs, event.sportList, accreditations, dateFilter]);

  // ... (keeping loadZones, availableDates, areaSummary, sportSummary as is)

  // Scan modes that come from real gate scanners (not self-service)
  const GATE_SCAN_MODES = ["zone_check_in", "zone_check_out"];

  // CALCULATE PRESENCE SUMMARY (Who is currently where)
  // Only includes scans from real gate operators, not self-scan or info modes
  const presenceSummary = useMemo(() => {
    const summaryMap = {};
    
    // Only process gate-scanner events in chronological order
    const gateLogs = logs
      .filter(log => GATE_SCAN_MODES.includes(log.scan_mode))
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    
    gateLogs.forEach(log => {
      const athleteId = log.athlete_id;
      if (!athleteId) return;

      const zoneName = log.device_label || "Unknown Zone";
      
      if (!summaryMap[athleteId]) {
        summaryMap[athleteId] = {
          athlete: log.accreditations,
          zones: {}
        };
      }

      const currentZone = summaryMap[athleteId].zones[zoneName] || { 
        status: "Never Entered", 
        lastIn: null, 
        lastOut: null,
        totalEntries: 0
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

    // Flatten for easy display/filtering
    const flattened = [];
    Object.entries(summaryMap).forEach(([athleteId, data]) => {
      Object.entries(data.zones).forEach(([zoneName, stats]) => {
        flattened.push({
          id: `${athleteId}-${zoneName}`,
          athlete: data.athlete,
          zone: zoneName,
          ...stats
        });
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
      
      // We still use resolved_area for filtering the raw logs
      const matchesArea = selectedArea === "all" || 
                         (log.resolved_area === selectedArea);
      
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
      
      // 1. Raw Audit Logs Sheet
      const logExport = filteredLogs.map(log => ({
        'Scan Time': new Date(log.created_at).toLocaleString(),
        'Participant': `${log.accreditations?.first_name || 'Guest'} ${log.accreditations?.last_name || ''}`,
        'Badge #': log.accreditations?.badge_number || 'N/A',
        'Mode': log.scan_mode?.replace('zone_', '').toUpperCase() || 'SCAN',
        'Location': log.device_label || 'Main Entrance'
      }));

      // 2. Presence Summary Sheet
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
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="space-y-4">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted ml-1">Live Scan Statistics</label>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          <div className="bg-[#1e293b] border border-gray-700/50 p-3 rounded-xl shadow-sm group">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-sky-500/10 rounded-lg text-sky-400">
                <Activity className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Scans</span>
            </div>
            <p className="text-xl font-black text-white">{totalUniqueScanned}</p>
          </div>

          {Object.entries(areaSummary).map(([area, data]) => (
            <div key={area} className="bg-[#1e293b] border border-gray-700/50 p-3 rounded-xl shadow-sm group">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400">
                  <MapPin className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 truncate" title={area}>{area}</span>
              </div>
              <p className="text-xl font-black text-white">{data.scanned.size}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="bg-[#1e293b]/50 border border-gray-700/50 p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between backdrop-blur-sm">
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto items-center">
          {/* View Mode Toggle */}
          <div className="flex bg-slate-900 border border-gray-700 rounded-xl p-1 shrink-0">
            <button 
              onClick={() => setViewMode("ledger")}
              className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'ledger' ? 'bg-sky-500 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Raw Logs
            </button>
            <button 
              onClick={() => setViewMode("presence")}
              className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'presence' ? 'bg-emerald-500 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Presence Summary
            </button>
          </div>

          <div className="h-6 w-px bg-gray-700 hidden md:block mx-2" />

          {/* Search Term */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input 
              type="text"
              placeholder="Search registrant..."
              className="bg-slate-900 border border-gray-700 rounded-xl pl-10 pr-4 py-2 text-sm w-full md:w-64 text-white focus:ring-2 focus:ring-sky-500/50 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Area Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
            <select
              className="bg-slate-900 border border-gray-700 text-white rounded-xl pl-10 pr-10 py-2 text-sm focus:ring-2 focus:ring-emerald-500/50 outline-none appearance-none cursor-pointer hover:bg-slate-800 transition-colors min-w-[200px]"
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
            >
              <option value="all" className="bg-slate-900">All Locations</option>
              {Object.keys(areaSummary).sort().map(a => (
                <option key={a} value={a} className="bg-slate-900">{a}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
        </div>

        <Button icon={Download} onClick={exportToExcel} variant="secondary" className="w-full md:w-auto bg-emerald-600/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/20">
          Export Report
        </Button>
      </div>

      {/* Main Table */}
      <div className="bg-[#1e293b]/30 border border-gray-700/50 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          {viewMode === "ledger" ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-700 bg-slate-900 shadow-xl border-t-2 border-t-sky-500/50">
                  <th className="px-6 py-6 text-[11px] font-black text-sky-500 uppercase tracking-[0.2em] bg-sky-500/5">TIME</th>
                  <th className="px-6 py-6 text-[11px] font-black text-sky-500 uppercase tracking-[0.2em] bg-sky-500/5">PARTICIPANT</th>
                  <th className="px-6 py-6 text-[11px] font-black text-sky-500 uppercase tracking-[0.2em] bg-sky-500/5">BADGE</th>
                  <th className="px-6 py-6 text-[11px] font-black text-sky-500 uppercase tracking-[0.2em] text-center bg-sky-500/5">MODE</th>
                  <th className="px-6 py-6 text-[11px] font-black text-sky-500 uppercase tracking-[0.2em] bg-sky-500/5">GATE LOCATION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/30">
                {loading ? (
                  <tr><td colSpan="5" className="py-20 text-center text-gray-500 animate-pulse font-bold">LOADING DATA...</td></tr>
                ) : filteredLogs.length === 0 ? (
                  <tr><td colSpan="5" className="py-20 text-center text-gray-400">No logs found</td></tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-white mb-1">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        <p className="text-[10px] text-gray-500 font-medium uppercase">{new Date(log.created_at).toLocaleDateString()}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-black text-white uppercase tracking-tight">
                          {log.accreditations ? `${log.accreditations.first_name} ${log.accreditations.last_name}` : 'Guest'}
                        </p>
                        <p className="text-[10px] text-sky-500 font-bold uppercase tracking-widest opacity-60">
                          {log.accreditations?.role || 'Guest'}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono font-bold text-gray-400">#{log.accreditations?.badge_number || 'N/A'}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest inline-block ${
                          log.scan_mode === 'zone_check_in' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          log.scan_mode === 'zone_check_out' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          'bg-sky-500/10 text-sky-500 border border-sky-500/20'
                        }`}>
                          {log.scan_mode?.replace('zone_', '').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400 font-medium font-mono italic">{log.device_label || 'Main Entrance'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-700 bg-slate-900 shadow-xl border-t-2 border-t-emerald-500/50">
                  <th className="px-6 py-6 text-[11px] font-black text-emerald-500 uppercase tracking-[0.2em] bg-emerald-500/5">PARTICIPANT</th>
                  <th className="px-6 py-6 text-[11px] font-black text-emerald-500 uppercase tracking-[0.2em] bg-emerald-500/5">ZONE</th>
                  <th className="px-6 py-6 text-[11px] font-black text-emerald-500 uppercase tracking-[0.2em] text-center bg-emerald-500/5">STATUS</th>
                  <th className="px-6 py-6 text-[11px] font-black text-emerald-500 uppercase tracking-[0.2em] bg-emerald-500/5">LAST ENTRY</th>
                  <th className="px-6 py-6 text-[11px] font-black text-emerald-500 uppercase tracking-[0.2em] bg-emerald-500/5">LAST EXIT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/30">
                {loading ? (
                  <tr><td colSpan="5" className="py-20 text-center text-gray-500 animate-pulse font-bold">CALCULATING PRESENCE...</td></tr>
                ) : filteredPresence.length === 0 ? (
                  <tr><td colSpan="5" className="py-20 text-center text-gray-400 font-medium">No presence data available for selected criteria</td></tr>
                ) : (
                  filteredPresence.map((item) => (
                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-black text-white uppercase tracking-tight">
                          {item.athlete ? `${item.athlete.first_name} ${item.athlete.last_name}` : 'Unknown'}
                        </p>
                        <p className="text-xs font-mono text-gray-500 font-bold">#{item.athlete?.badge_number}</p>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-gray-300">{item.zone}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                          item.status === 'Inside' 
                            ? 'bg-emerald-500 text-white animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                            : 'bg-slate-700 text-slate-400'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-sky-400">
                        {item.lastIn ? new Date(item.lastIn).toLocaleTimeString() : '---'}
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-amber-400">
                        {item.lastOut ? new Date(item.lastOut).toLocaleTimeString() : '---'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
