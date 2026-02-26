import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Calendar,
  LogIn,
  LogOut,
  Plus,
  Edit,
  Trash
} from "lucide-react";
import Card, { CardHeader, CardContent } from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import EmptyState from "../../components/ui/EmptyState";
import { AuditAPI } from "../../lib/storage";
import { formatDate } from "../../lib/utils";

const getActionConfig = (action) => {
  const configs = {
    accreditation_approved: {
      icon: CheckCircle,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/20",
      label: "Accreditation Approved"
    },
    accreditation_rejected: {
      icon: XCircle,
      color: "text-red-400",
      bgColor: "bg-red-500/20",
      label: "Accreditation Rejected"
    },
    accreditation_submitted: {
      icon: Clock,
      color: "text-amber-400",
      bgColor: "bg-amber-500/20",
      label: "Accreditation Submitted"
    },
    accreditation_deleted: {
      icon: Trash,
      color: "text-red-400",
      bgColor: "bg-red-500/20",
      label: "Accreditation Deleted"
    },
    event_created: {
      icon: Plus,
      color: "text-blue-400",
      bgColor: "bg-blue-500/20",
      label: "Event Created"
    },
    event_updated: {
      icon: Edit,
      color: "text-blue-400",
      bgColor: "bg-blue-500/20",
      label: "Event Updated"
    },
    event_deleted: {
      icon: Trash,
      color: "text-red-400",
      bgColor: "bg-red-500/20",
      label: "Event Deleted"
    },
    user_created: {
      icon: Plus,
      color: "text-purple-400",
      bgColor: "bg-purple-500/20",
      label: "User Created"
    },
    user_deleted: {
      icon: Trash,
      color: "text-red-400",
      bgColor: "bg-red-500/20",
      label: "User Deleted"
    },
    user_login: {
      icon: LogIn,
      color: "text-green-400",
      bgColor: "bg-green-500/20",
      label: "User Login"
    },
    user_logout: {
      icon: LogOut,
      color: "text-slate-400",
      bgColor: "bg-slate-500/20",
      label: "User Logout"
    }
  };

  return configs[action] || {
    icon: Activity,
    color: "text-slate-400",
    bgColor: "bg-slate-500/20",
    label: action.replace(/_/g, " ")
  };
};

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    setLogs(AuditAPI.getRecent(100));
  }, []);

  const filteredLogs = logs.filter((log) => {
    if (filter === "all") return true;
    return log.action.startsWith(filter);
  });

  const filters = [
    { value: "all", label: "All Activity" },
    { value: "accreditation", label: "Accreditations" },
    { value: "event", label: "Events" },
    { value: "user", label: "Users" }
  ];

  return (
    <div id="audit_page" className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Audit Log</h1>
        <p className="text-lg text-slate-400 font-extralight">
          Track all system activity and changes
        </p>
      </div>

      <Card>
        <CardContent>
          <div className="flex gap-2">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-4 py-2 rounded-lg text-lg font-medium transition-colors ${
                  filter === f.value
                    ? "bg-primary-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {filteredLogs.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No Activity"
          description="System activity will appear here"
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-800">
              {filteredLogs.map((log, index) => {
                const config = getActionConfig(log.action);
                const Icon = config.icon;

                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.02 }}
                    className="p-4 hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-2.5 rounded-lg ${config.bgColor}`}>
                        <Icon className={`w-5 h-5 ${config.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-lg font-medium text-white">
                            {config.label}
                          </p>
                          <Badge variant="default" className="text-lg">
                            {log.userName}
                          </Badge>
                        </div>
                        {log.details && (
                          <div className="text-lg text-slate-400 space-y-1">
                            {Object.entries(log.details).map(([key, value]) => (
                              <p key={key}>
                                <span className="text-slate-500">{key}:</span>{" "}
                                <span className="font-mono">{String(value)}</span>
                              </p>
                            ))}
                          </div>
                        )}
                        <p className="text-lg text-slate-500 mt-2">
                          {formatDate(log.timestamp, "MMM dd, yyyy 'at' HH:mm:ss")}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
