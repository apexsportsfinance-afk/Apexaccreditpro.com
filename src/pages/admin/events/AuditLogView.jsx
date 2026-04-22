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
  const [dateFilter, setDateFilter] = useState("all"); // 'all' or 'YYYY-MM-DD'
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
        AttendanceAPI.getScanLogsByEvent(event.id, 1000),
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
    
    // 1. Initialize with all defined zones
    zones.forEach(z => {
      // Find how many people are allocated to this zone
      const allocatedCount = accreditations.filter(acc => 
        acc.zoneCode === z.code || 
        (acc.zoneCode && acc.zoneCode.includes(z.code))
      ).length;

      summary[z.name] = { 
        scanned: new Set(), // Store unique athlete IDs
        allocated: allocatedCount,
        code: z.code 
      };
    });

    // 2. Count actual scans from logs (respecting date filter)
    logs.forEach(log => {
      const logDate = new Date(log.created_at).toISOString().split('T')[0];
      if (dateFilter !== "all" && logDate !== dateFilter) return;

      const label = log.device_label || 'Other';
      if (summary[label]) {
        if (log.athlete_id) summary[label].scanned.add(log.athlete_id);
      }
    });

    return summary;
  }, [logs, zones, accreditations, dateFilter]);

  // Summarize by Sport with Allocation Ratios
  const sportSummary = useMemo(() => {
    const summary = {};
    const sports = event.sportList || ["Swimming"];
    
    sports.forEach(s => { 
      const allocated = accreditations.filter(acc => 
        acc.selectedSports && acc.selectedSports.includes(s)
      ).length;

      summary[s] = { 
        scanned: new Set(), 
        allocated 
      }; 
    });

    logs.forEach(log => {
      const logDate = new Date(log.created_at).toISOString().split('T')[0];
      if (dateFilter !== "all" && logDate !== dateFilter) return;

      const athleteSports = log.accreditations?.selected_sports || [];
      athleteSports.forEach(s => {
        if (summary[s]) {
          if (log.athlete_id) summary[s].scanned.add(log.athlete_id);
        }
      });
    });
    return summary;
  }, [logs, event.sportList, accreditations, dateFilter]);

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
      
      const matchesArea = selectedArea === "all" || 
                         (log.device_label === selectedArea);
      
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
      
      const exportData = filteredLogs.map(log => ({
        'Scan Date/Time': new Date(log.created_at).toLocaleString(),
        'Gate Location': log.device_label || 'Unknown',
        'Athlete Name': `${log.accreditations?.first_name || 'Guest'} ${log.accreditations?.last_name || ''}`,
        'Badge #': log.accreditations?.badge_number || 'N/A',
        'Organization': log.accreditations?.club || 'N/A',
        'Scan Mode': log.scan_mode || 'manual',
        'Assigned Sports': log.accreditations?.selected_sports?.join(', ') || 'N/A'
      }));

      const summaryData = Object.entries(areaSummary).map(([area, count]) => ({
        'Gate Location': area,
        'Total Scans': count
      }));
      
      summaryData.push({
        'Gate Location': 'TOTAL',
        'Total Scans': logs.length
      });

      const wb = XLSX.utils.book_new();
      const wsRaw = XLSX.utils.json_to_sheet(exportData);
      XLSX.utils.book_append_sheet(wb, wsRaw, "Audit Logs");
      
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Location Summary");

      const fileName = `${event.slug}_scan_audit_${selectedArea}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success("Audit Log exported successfully");
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Failed to export to Excel");
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards - Comprehensive Coverage */}
      <div className="space-y-4">
        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted ml-1">Live Scan Statistics</label>
        
        {/* Main Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          <div className="bg-[#1e293b] border border-gray-700/50 p-3 rounded-xl shadow-sm hover:shadow-md transition-shadow group flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-1">
              <div className="p-1.5 bg-sky-500/10 rounded-lg text-sky-400 group-hover:bg-sky-500/20 transition-colors">
                <Activity className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Total Scans</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-baseline gap-1.5">
                <p className="text-xl font-black text-white">{totalUniqueScanned}</p>
                <sub className="text-[10px] font-bold text-gray-500 uppercase">/ {accreditations.length} Athletes</sub>
              </div>
              <div className="w-full bg-base rounded-full h-1 mt-2.5 overflow-hidden">
                <div 
                  className="bg-sky-500 h-full rounded-full transition-all duration-1000" 
                  style={{ width: `${(totalUniqueScanned / (accreditations.length || 1)) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {Object.entries(areaSummary).map(([area, data]) => (
            <div key={area} className="bg-[#1e293b] border border-gray-700/50 p-3 rounded-xl shadow-sm hover:shadow-md transition-shadow group flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
                  <MapPin className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 truncate" title={area}>{area}</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-baseline gap-1">
                  <p className="text-xl font-black text-white">{data.scanned.size}</p>
                  <sub className="text-[9px] font-bold text-gray-500 lowercase">out of {data.allocated}</sub>
                </div>
                <div className="w-full bg-base rounded-full h-1 mt-2.5 overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all duration-1000" 
                    style={{ width: `${(data.scanned.size / (data.allocated || 1)) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Sport Specific Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
          {Object.entries(sportSummary).map(([sport, data]) => (
            <div key={sport} className="bg-slate-900/40 border border-slate-800 p-3 rounded-xl hover:bg-slate-800/40 transition-all group flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-400 group-hover:bg-amber-500/20 transition-colors">
                  <Trophy className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 truncate" title={sport}>{sport}</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-baseline gap-1">
                  <p className="text-lg font-black text-slate-200">{data.scanned.size}</p>
                  <sub className="text-[9px] font-bold text-slate-600 uppercase">/ {data.allocated}</sub>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1 mt-2 overflow-hidden">
                  <div 
                    className="bg-amber-500/60 h-full rounded-full transition-all duration-1000" 
                    style={{ width: `${(data.scanned.size / (data.allocated || 1)) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="bg-[#1e293b]/50 border border-gray-700/50 p-4 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between backdrop-blur-sm">
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
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

          {/* Date Filter */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" />
            <select
              className="bg-slate-900 border border-gray-700 text-white rounded-xl pl-10 pr-10 py-2 text-sm focus:ring-2 focus:ring-amber-500/50 outline-none appearance-none cursor-pointer hover:bg-slate-800 transition-colors min-w-[200px]"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            >
              <option value="all" className="bg-slate-900">Overall Totals</option>
              {availableDates.map(d => (
                <option key={d} value={d} className="bg-slate-900">Day: {new Date(d).toLocaleDateString()}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>

          {/* Area Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
            <select
              className="bg-slate-900 border border-gray-700 text-white rounded-xl pl-10 pr-10 py-2 text-sm focus:ring-2 focus:ring-emerald-500/50 outline-none appearance-none cursor-pointer hover:bg-slate-800 transition-colors min-w-[200px]"
              value={selectedArea}
              onChange={(e) => setSelectedArea(e.target.value)}
            >
              <option value="all" className="bg-slate-900">All Locations / Areas</option>
              {Object.keys(areaSummary).sort().map(a => (
                <option key={a} value={a} className="bg-slate-900">{a}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
        </div>

        <Button icon={Download} onClick={exportToExcel} variant="secondary" className="w-full md:w-auto bg-emerald-600/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/20">
          Export Audit Log
        </Button>
      </div>

      {/* Logs Table */}
      <div className="bg-[#1e293b]/30 border border-gray-700/50 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-700 bg-slate-900 shadow-xl border-t-2 border-t-amber-500/50">
                <th className="px-6 py-6 text-[11px] font-black text-amber-500 uppercase tracking-[0.2em] bg-amber-500/5">
                  <div className="flex items-center gap-2">
                    <Activity className="w-3 h-3 opacity-70" />
                    TIME
                  </div>
                </th>
                <th className="px-6 py-6 text-[11px] font-black text-amber-500 uppercase tracking-[0.2em] bg-amber-500/5">
                  <div className="flex items-center gap-2">
                    <Users className="w-3 h-3 opacity-70" />
                    ATHLETE / STAFF
                  </div>
                </th>
                <th className="px-6 py-6 text-[11px] font-black text-amber-500 uppercase tracking-[0.2em] bg-amber-500/5">BADGE</th>
                <th className="px-6 py-6 text-[11px] font-black text-amber-500 uppercase tracking-[0.2em] bg-amber-500/5">ORGANIZATION</th>
                <th className="px-6 py-6 text-[11px] font-black text-amber-500 uppercase tracking-[0.2em] text-center bg-amber-500/5">MODE</th>
                <th className="px-6 py-6 text-[11px] font-black text-amber-500 uppercase tracking-[0.2em] bg-amber-500/5">GATE LOCATION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/30">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-20 text-center">
                    <Activity className="w-8 h-8 text-sky-500 animate-spin mx-auto mb-2" />
                    <p className="text-gray-400 text-sm font-bold animate-pulse">SYNCHRONIZING LOGS...</p>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-20 text-center text-gray-500 font-medium bg-slate-900/20">
                    No matching scanner logs found
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-white leading-none mb-1">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <p className="text-[10px] text-gray-500 font-medium uppercase">{new Date(log.created_at).toLocaleDateString()}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400 border border-sky-500/20 group-hover:scale-110 transition-transform">
                          <Users className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-black text-white uppercase tracking-tight">
                            {log.accreditations ? `${log.accreditations.first_name} ${log.accreditations.last_name}` : 
                             log.spectator_orders ? log.spectator_orders.customer_name : 'Guest Participant'}
                          </p>
                          <p className="text-[10px] text-sky-500 font-bold uppercase tracking-widest opacity-60">
                            {log.accreditations?.role || 'Guest'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-mono font-bold text-gray-400">
                      {log.accreditations?.badge_number || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-300 font-medium">
                      {log.accreditations?.club || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest inline-block ${
                        log.scan_mode === 'manual' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 
                        'bg-sky-500/10 text-sky-500 border border-sky-500/20'
                      }`}>
                        {log.scan_mode}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400 font-medium">
                      {log.device_label || 'Main Entrance'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
