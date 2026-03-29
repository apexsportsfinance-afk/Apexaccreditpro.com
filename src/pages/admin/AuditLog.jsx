import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Activity,
  RefreshCw,
  Search,
  Clock,
  User,
  Info,
  Smartphone,
  Ticket,
  BadgeCheck,
  Eye,
  ArrowRightLeft,
  Trophy,
  FileDown,
  LayoutList,
  Layers
} from "lucide-react";
import * as XLSX from "xlsx";
import Card, { CardHeader, CardContent } from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";
import { useToast } from "../../components/ui/Toast";
import { AuditAPI } from "../../lib/storage";
import { AttendanceAPI } from "../../lib/attendanceApi";
import { formatDate } from "../../lib/utils";

const ACTION_COLORS = {
  accreditation_approved: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  accreditation_rejected: "text-red-400 bg-red-500/10 border-red-500/30",
  accreditation_submitted: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  accreditation_deleted: "text-red-400 bg-red-500/10 border-red-500/30",
  accreditation_updated: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  event_created: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
  event_updated: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
  event_deleted: "text-red-400 bg-red-500/10 border-red-500/30",
  zone_created: "text-purple-400 bg-purple-500/10 border-purple-500/30",
  zone_updated: "text-purple-400 bg-purple-500/10 border-purple-500/30",
  zone_deleted: "text-red-400 bg-red-500/10 border-red-500/30",
  user_created: "text-green-400 bg-green-500/10 border-green-500/30",
  user_updated: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  user_deleted: "text-red-400 bg-red-500/10 border-red-500/30"
};

const getActionColor = (action) =>
  ACTION_COLORS[action] || "text-slate-400 bg-slate-500/10 border-slate-500/30";

const formatAction = (action) =>
  (action || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function AuditLog() {
  const [activeTab, setActiveTab] = useState("system"); // system | scanner
  const [viewMode, setViewMode] = useState("raw"); // raw | summary
  const [logs, setLogs] = useState([]);
  const [scannerLogs, setScannerLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const toast = useToast();

  useEffect(() => {
    if (activeTab === "system") loadLogs();
    else loadScannerLogs();
  }, [activeTab]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await AuditAPI.getRecent(100);
      setLogs(data);
    } catch (err) {
      console.error("Audit log error:", err);
      toast.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  const loadScannerLogs = async () => {
    setLoading(true);
    try {
      const data = await AttendanceAPI.getScanLogs(1000);
      setScannerLogs(data);
    } catch (err) {
      console.error("Scanner log error:", err);
      toast.error("Failed to load scanner logs");
    } finally {
      setLoading(false);
    }
  };

  const handleExportSummary = () => {
    if (scannerLogs.length === 0) {
      toast.error("No logs to export");
      return;
    }

    // 1. Summarize Logs
    const summaryMap = new Map();

    scannerLogs.forEach(log => {
      const isAthlete = !!log.accreditations;
      const isSpectator = !!log.spectator_orders;

      const id = isAthlete ? log.accreditations.id : (isSpectator ? log.spectator_orders.id : 'unknown');
      const name = isAthlete ? `${log.accreditations.first_name} ${log.accreditations.last_name}` :
        (isSpectator ? log.spectator_orders.customer_name : 'System');
      const club = isAthlete ? (log.accreditations.club || 'Independent') :
        (isSpectator ? 'Spectator' : 'N/A');
      const role = isAthlete ? (log.accreditations.role || 'Athlete') :
        (isSpectator ? 'Spectator' : 'System');

      if (!summaryMap.has(id)) {
        summaryMap.set(id, {
          "Name": name,
          "Club/Team": club,
          "Role": role,
          "Scan Count": 0,
          "Last Scan": log.created_at
        });
      }

      const entry = summaryMap.get(id);
      entry["Scan Count"] += 1;
      if (new Date(log.created_at) > new Date(entry["Last Scan"])) {
        entry["Last Scan"] = log.created_at;
      }
    });

    const data = Array.from(summaryMap.values());

    // 2. Create Workbook
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Scan Summary");

    // 3. Trigger Download
    const fileName = `Scan_Audit_Summary_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast.success("Excel Summary Exported");
  };

  const filteredLogs = (activeTab === "system" ? logs : scannerLogs).filter((log) => {
    if (!search) return true;
    const q = search.toLowerCase();

    if (activeTab === "system") {
      return (
        log.action?.toLowerCase().includes(q) ||
        log.userName?.toLowerCase().includes(q) ||
        JSON.stringify(log.details || {}).toLowerCase().includes(q)
      );
    } else {
      const athleteName = `${log.accreditations?.first_name} ${log.accreditations?.last_name}`.toLowerCase();
      const spectatorName = log.spectator_orders?.customer_name?.toLowerCase() || "";
      const club = log.accreditations?.club?.toLowerCase() || "";
      return (
        athleteName.includes(q) ||
        spectatorName.includes(q) ||
        club.includes(q) ||
        log.scan_mode?.includes(q) ||
        log.device_label?.toLowerCase().includes(q)
      );
    }
  });

  return (
    <div id="auditlog_page" className="space-y-6">

      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40 p-6 rounded-3xl border border-white/5 backdrop-blur-xl">
        <div>
          <h1 className="font-h1 text-whiteElite mb-1 uppercase tracking-tight flex items-center gap-3">
            <ArrowRightLeft className="w-6 h-6 text-cyan-400" />
            Audit Center
          </h1>
          <p className="text-xs text-slate-500 font-medium tracking-widest uppercase opacity-70">
            {activeTab === 'system' ? 'System Ledger: Administrative Custody' : 'Scanner Ledger: Real-time QR Activity'}
          </p>
        </div>

        <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/10 shrink-0">
          <TabButton
            active={activeTab === 'system'}
            onClick={() => setActiveTab('system')}
            label="System Logs"
            icon={Activity}
          />
          <TabButton
            active={activeTab === 'scanner'}
            onClick={() => {
              setActiveTab('scanner');
              if (viewMode === 'summary') setViewMode('raw');
            }}
            label="Scanner Logs"
            icon={Smartphone}
          />
        </div>

        {activeTab === 'scanner' && (
          <div className="flex items-center bg-black/20 p-1 rounded-xl border border-white/5 ml-2">
            <button
              onClick={() => setViewMode('raw')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'raw' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <LayoutList className="w-3 h-3" />
              Raw
            </button>
            <button
              onClick={() => setViewMode('summary')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-2 text-[9px] font-black uppercase tracking-widest transition-all ${viewMode === 'summary' ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Layers className="w-3 h-3" />
              Summary
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          {activeTab === 'scanner' && (
            <button
              onClick={handleExportSummary}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:text-white hover:bg-emerald-500/20 transition-all text-xs font-black uppercase tracking-widest shadow-lg"
            >
              <FileDown className="w-3.5 h-3.5" />
              Export
            </button>
          )}

          <button
            onClick={activeTab === 'system' ? loadLogs : loadScannerLogs}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:text-white hover:bg-cyan-500/20 transition-all text-xs font-black uppercase tracking-widest shadow-lg"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Sync
          </button>
        </div>
      </div>

      <Card className="border-white/5 ring-0 shadow-2xl">
        <CardHeader className="bg-white/[0.02]">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={activeTab === 'system' ? "Search actions, users..." : "Search athletes, clubs, tickets..."}
              className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700/60 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/60 transition-all"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <RefreshCw className="w-12 h-12 text-cyan-500 animate-spin" />
              <p className="text-xs font-black text-slate-500 uppercase tracking-widest animate-pulse">Synchronizing Ledger...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <EmptyState
              icon={activeTab === 'system' ? Activity : Smartphone}
              title="No Activity Found"
              description={`The ${activeTab} ledger is currently empty`}
            />
          ) : (
            <div className="overflow-x-auto">
              {activeTab === "system" ? (
                <div className="divide-y divide-white/[0.03]">
                  {filteredLogs.map((log, index) => (
                    <SystemLogRow key={log.id || index} log={log} index={index} />
                  ))}
                </div>
              ) : viewMode === 'raw' ? (
                <ScannerLogsTable logs={filteredLogs} />
              ) : (
                <ScannerSummaryTable logs={filteredLogs} />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-center gap-4 text-[10px] font-black uppercase tracking-widest text-slate-500/50">
        <div className="w-12 h-px bg-white/5" />
        <span>Displaying {filteredLogs.length} Entri{filteredLogs.length === 1 ? 'y' : 'es'}</span>
        <div className="w-12 h-px bg-white/5" />
      </div>
    </div>
  );
}

function TabButton({ active, onClick, label, icon: Icon }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${active ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-900/20' : 'text-slate-500 hover:text-slate-300'
        }`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );
}

function SystemLogRow({ log, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.01 }}
      className="p-5 hover:bg-white/[0.02] transition-colors group"
    >
      <div className="flex items-start gap-4">
        <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700/60 flex-shrink-0 mt-0.5">
          <Activity className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
        </div>
        <div className="flex-1 min-w-0">
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${getActionColor(log.action)}`}>
            {formatAction(log.action)}
          </span>
          <div className="flex items-center gap-4 mt-2.5">
            <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
              <User className="w-3 h-3 text-cyan-500/60" />
              {log.userName || "SEC_SYSTEM"}
            </span>
            <span className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500">
              <Clock className="w-3 h-3" />
              {formatDate(log.timestamp, "MMM dd, yyyy HH:mm")}
            </span>
          </div>
          {log.details && Object.keys(log.details).length > 0 && (
            <div className="mt-3 p-3 rounded-xl bg-black/20 border border-white/5">
              <p className="text-[10px] font-mono text-slate-500 line-clamp-1">
                {Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(" | ")}
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ScannerLogsTable({ logs }) {
  // 1. Sort by latest scan first (Requested)
  const sortedLogs = [...logs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // 2. Pre-calculate totals for the contextually relevant "No Of Scans" column
  const userTotals = new Map();
  logs.forEach(log => {
    const isAthlete = !!log.accreditations;
    const isSpectator = !!log.spectator_orders;
    const id = isAthlete ? log.accreditations.id : (isSpectator ? log.spectator_orders.id : 'unknown');
    userTotals.set(id, (userTotals.get(id) || 0) + 1);
  });

  return (
    <table className="w-full text-left border-separate border-spacing-0">
      <thead>
        <tr className="bg-white/[0.02]">
          <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-white/5">Name</th>
          <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-white/5">Club Name</th>
          <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-white/5">Role</th>
          <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-white/5 text-center">No Of Scans</th>
          <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-white/5 text-right">Timestamp with Date</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-white/[0.03]">
        {sortedLogs.map((log, idx) => {
          const isAthlete = !!log.accreditations;
          const isSpectator = !!log.spectator_orders;
          const id = isAthlete ? log.accreditations.id : (isSpectator ? log.spectator_orders.id : 'unknown');
          const name = isAthlete ? `${log.accreditations.first_name} ${log.accreditations.last_name}` :
            (isSpectator ? log.spectator_orders.customer_name : 'System Relay');
          const club = isAthlete ? (log.accreditations.club || 'Independent') :
            (isSpectator ? 'Spectator' : 'N/A');
          const role = isAthlete ? (log.accreditations.role || 'Athlete') :
            (isSpectator ? 'Spectator' : 'System');
          const totalScans = userTotals.get(id) || 1;

          return (
            <motion.tr
              key={log.id || idx}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.01, 1) }}
              className="group hover:bg-yellow-500/[0.03] transition-colors"
            >
              <td className="py-4 px-6 border-b border-white/[0.02] group-hover:border-yellow-500/20">
                <span className="text-xs font-black text-white uppercase tracking-tight group-hover:text-yellow-400 transition-colors">
                  {name}
                </span>
              </td>
              <td className="py-4 px-6 border-b border-white/[0.02] group-hover:border-yellow-500/20">
                <span className="text-[10px] font-bold text-slate-400 uppercase group-hover:text-slate-200">
                  {club}
                </span>
              </td>
              <td className="py-4 px-6 border-b border-white/[0.02] group-hover:border-yellow-500/20">
                <span className="text-[9px] font-black px-2 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10 uppercase group-hover:bg-yellow-500/10 group-hover:text-yellow-400 group-hover:border-yellow-500/20">
                  {role}
                </span>
              </td>
              <td className="py-4 px-6 border-b border-white/[0.02] group-hover:border-yellow-500/20 text-center">
                <span className="text-xs font-mono font-black text-white bg-white/10 px-2.5 py-1 rounded-lg border border-white/10 group-hover:border-yellow-500/30 group-hover:bg-yellow-500/10 group-hover:text-yellow-400">
                  {totalScans}
                </span>
              </td>
              <td className="py-4 px-6 border-b border-white/[0.02] group-hover:border-yellow-500/20 text-right">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-white/40 uppercase group-hover:text-yellow-400/60">
                    {new Date(log.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  <span className="text-[10px] font-mono text-cyan-400/60 group-hover:text-cyan-400">
                    {new Date(log.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              </td>
            </motion.tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ScannerSummaryTable({ logs }) {
  // 1. Group by entity (Aggregated view)
  const summaryMap = new Map();
  logs.forEach(log => {
    const isAthlete = !!log.accreditations;
    const isSpectator = !!log.spectator_orders;
    const id = isAthlete ? log.accreditations.id : (isSpectator ? log.spectator_orders.id : 'unknown');

    if (!summaryMap.has(id)) {
      summaryMap.set(id, {
        name: isAthlete ? `${log.accreditations.first_name} ${log.accreditations.last_name}` :
          (isSpectator ? log.spectator_orders.customer_name : 'System Relay'),
        club: isAthlete ? (log.accreditations.club || 'Independent') :
          (isSpectator ? 'Spectator' : 'N/A'),
        role: isAthlete ? (log.accreditations.role || 'Athlete') :
          (isSpectator ? 'Spectator' : 'System'),
        badge: isAthlete ? (log.accreditations.badge_number || 'N/A') : 'N/A',
        location: log.device_label || 'Default',
        count: 0,
        latestScan: log.created_at
      });
    }
    const entry = summaryMap.get(id);
    entry.count += 1;
    if (new Date(log.created_at) > new Date(entry.latestScan)) {
      entry.latestScan = log.created_at;
      entry.location = log.device_label || 'Default';
    }
  });

  const data = Array.from(summaryMap.values()).sort((a, b) => new Date(b.latestScan) - new Date(a.latestScan));

  return (
    <table className="w-full text-left border-separate border-spacing-0">
      <thead>
        <tr className="bg-white/[0.02]">
          <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-white/5">Name</th>
          <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-white/5">Badge #</th>
          <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-white/5">Club Name</th>
          <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-white/5">Role</th>
          <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-white/5">Last Location</th>
          <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-white/5 text-center">No Of Scans</th>
          <th className="py-4 px-6 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-b border-white/5 text-right">Latest Scan</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-white/[0.03]">
        {data.map((row, idx) => (
          <motion.tr
            key={idx}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(idx * 0.01, 1) }}
            className="group hover:bg-emerald-500/[0.03] transition-colors"
          >
            <td className="py-4 px-6 border-b border-white/[0.02]">
              <span className="text-xs font-black text-white uppercase group-hover:text-emerald-400 transition-colors">{row.name}</span>
            </td>
            <td className="py-4 px-6 border-b border-white/[0.02]">
              <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase">{row.badge}</span>
            </td>
            <td className="py-4 px-6 border-b border-white/[0.02]">
              <span className="text-[10px] font-bold text-slate-400 uppercase">{row.club}</span>
            </td>
            <td className="py-4 px-6 border-b border-white/[0.02]">
              <span className="text-[9px] font-black px-2 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10 uppercase">{row.role}</span>
            </td>
            <td className="py-4 px-6 border-b border-white/[0.02]">
              <span className="text-[10px] font-bold text-slate-400 uppercase italic opacity-60">{row.location}</span>
            </td>
            <td className="py-4 px-6 border-b border-white/[0.02] text-center">
              <span className="text-xs font-mono font-black text-white bg-white/10 px-2.5 py-1 rounded-lg border border-white/10">{row.count}</span>
            </td>
            <td className="py-4 px-6 border-b border-white/[0.02] text-right">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-black text-white/40 uppercase">{new Date(row.latestScan).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                <span className="text-[10px] font-mono text-cyan-400/60">{new Date(row.latestScan).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
            </td>
          </motion.tr>
        ))}
      </tbody>
    </table>
  );
}
