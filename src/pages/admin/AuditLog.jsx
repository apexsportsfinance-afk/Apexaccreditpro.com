import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { Activity, RefreshCw, Search, Clock, User, Info } from "lucide-react";
import Card, { CardHeader, CardContent } from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";
import { useToast } from "../../components/ui/Toast";
import { AuditAPI } from "../../lib/storage";
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
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const toast = useToast();

  useEffect(() => {
    loadLogs();
  }, []);

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

  const filteredLogs = logs.filter((log) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      log.action?.toLowerCase().includes(q) ||
      log.userName?.toLowerCase().includes(q) ||
      JSON.stringify(log.details || {}).toLowerCase().includes(q)
    );
  });

  return (
    <div id="auditlog_page" className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Audit Log</h1>
          <p className="text-lg text-slate-400 font-extralight">
            Track all system actions and changes
          </p>
        </div>
        <button
          onClick={loadLogs}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-slate-300 hover:text-white hover:bg-slate-700/80 transition-colors text-lg"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <Card>
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search logs..."
              className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700/60 rounded-lg text-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/60 focus:border-cyan-600"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="No Activity Yet"
              description="System actions will appear here"
            />
          ) : (
            <div className="divide-y divide-slate-800">
              {filteredLogs.map((log, index) => (
                <motion.div
                  key={log.id || index}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.015 }}
                  className="p-4 hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-slate-800 border border-slate-700/60 flex-shrink-0 mt-0.5">
                      <Activity className="w-4 h-4 text-primary-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-lg font-medium border ${getActionColor(log.action)}`}>
                          {formatAction(log.action)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                        <span className="flex items-center gap-1.5 text-lg text-slate-500">
                          <User className="w-3.5 h-3.5" />
                          {log.userName || "System"}
                        </span>
                        <span className="flex items-center gap-1.5 text-lg text-slate-500">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDate(log.timestamp, "MMM dd, yyyy HH:mm")}
                        </span>
                      </div>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <div className="mt-2 flex items-start gap-1.5">
                          <Info className="w-3.5 h-3.5 text-slate-600 mt-0.5 flex-shrink-0" />
                          <p className="text-lg text-slate-500 truncate">
                            {Object.entries(log.details)
                              .slice(0, 3)
                              .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
                              .join(" • ")}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-lg text-slate-500 text-center font-extralight">
        Showing {filteredLogs.length} of {logs.length} entries
      </p>
    </div>
  );
}
