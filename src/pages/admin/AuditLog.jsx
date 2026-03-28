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
  Trophy
} from "lucide-react";
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
      const data = await AttendanceAPI.getScanLogs(100);
      setScannerLogs(data);
    } catch (err) {
      console.error("Scanner log error:", err);
      toast.error("Failed to load scanner logs");
    } finally {
      setLoading(false);
    }
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
             onClick={() => setActiveTab('scanner')} 
             label="Scanner Logs" 
             icon={Smartphone} 
          />
        </div>

        <button
          onClick={activeTab === 'system' ? loadLogs : loadScannerLogs}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:text-white hover:bg-cyan-500/20 transition-all text-xs font-black uppercase tracking-widest shadow-lg"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Sys-Sync
        </button>
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
            <div className="divide-y divide-white/[0.03]">
              {filteredLogs.map((log, index) => (
                activeTab === "system" ? (
                  <SystemLogRow key={log.id || index} log={log} index={index} />
                ) : (
                  <ScannerLogRow key={log.id || index} log={log} index={index} />
                )
              ))}
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
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
          active ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-900/20' : 'text-slate-500 hover:text-slate-300'
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

function ScannerLogRow({ log, index }) {
  const isAthlete = !!log.accreditations;
  const isSpectator = !!log.spectator_orders;
  const mode = log.scan_mode || "info";

  return (
    <motion.div
      initial={{ opacity: 0, x: 4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.01 }}
      className="p-5 hover:bg-white/[0.02] transition-colors group"
    >
      <div className="flex items-start gap-4">
        <div className={`p-2.5 rounded-xl border flex-shrink-0 mt-0.5 transition-transform group-hover:scale-110 ${
          mode === 'attendance' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
          mode === 'spectator' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
          'bg-purple-500/10 border-purple-500/20 text-purple-400'
        }`}>
          {mode === 'attendance' ? <BadgeCheck className="w-4 h-4" /> :
           mode === 'spectator' ? <Ticket className="w-4 h-4" /> :
           <Eye className="w-4 h-4" />}
        </div>
        
        <div className="flex-1 min-w-0">
           <div className="flex items-center gap-3 mb-1">
              <h4 className="text-white font-black uppercase text-xs tracking-tight">
                {isAthlete ? `${log.accreditations.first_name} ${log.accreditations.last_name}` : 
                 isSpectator ? log.spectator_orders.customer_name : 
                 "System Relay"}
              </h4>
              <span className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${
                mode === 'attendance' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                mode === 'spectator' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                'bg-purple-500/10 text-purple-400 border-purple-500/20'
              }`}>
                {mode}
              </span>
           </div>

           <div className="flex items-center gap-4 mt-2">
             {isAthlete && (
               <span className="flex items-center gap-1 text-[10px] font-bold text-orange-400 uppercase tracking-tight">
                 <Trophy className="w-3 h-3 opacity-60" />
                 {log.accreditations.club || "Independent"}
               </span>
             )}
             <span className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 mt-0.5">
               <Smartphone className="w-3 h-3 text-cyan-500/60" />
               {log.device_label || "Terminal-0"}
             </span>
             <span className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 mt-0.5">
               <Clock className="w-3 h-3 text-slate-600" />
               {formatDate(log.created_at, "HH:mm:ss")}
             </span>
           </div>
        </div>
      </div>
    </motion.div>
  );
}
