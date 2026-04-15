import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  MessageSquare, 
  Filter, 
  Search, 
  Star, 
  TrendingUp, 
  Users, 
  QrCode, 
  ExternalLink,
  ChevronRight,
  MoreVertical,
  Download,
  Calendar,
  Settings,
  Copy,
  Info
} from "lucide-react";
import { FeedbackAPI, EventsAPI } from "../../lib/storage";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import StatsCard from "../../components/ui/StatsCard";
import DataTable from "../../components/ui/DataTable";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";

const roles = ["Parent", "Athlete", "Coach", "Team Manager"];

export default function Feedback() {
  const [feedbacks, setFeedbacks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [events, setEvents] = useState([]);
  const [roleFilter, setRoleFilter] = useState("All");
  const [showSetup, setShowSetup] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const { canAccessEvent } = useAuth();

  useEffect(() => {
    async function init() {
      try {
        const evs = await EventsAPI.getAll();
        const filtered = evs.filter(e => canAccessEvent(e.id));
        setEvents(filtered);
        if (filtered.length > 0) setSelectedEventId(filtered[0].id);
      } catch (err) {
        toast.error("Failed to load events");
      }
    }
    init();
  }, []);

  useEffect(() => {
    async function loadData() {
      if (!selectedEventId) return;
      setLoading(true);
      try {
        const [all, st] = await Promise.all([
          FeedbackAPI.getAll(selectedEventId),
          FeedbackAPI.getStats(selectedEventId)
        ]);
        setFeedbacks(all);
        setStats(st);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load feedback data");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [selectedEventId]);

  const filteredFeedbacks = feedbacks.filter(f => 
    roleFilter === "All" || f.role === roleFilter
  );

  const getRoleBadge = (role) => {
    const variants = {
      "Parent": "info",
      "Athlete": "success",
      "Coach": "warning",
      "Team Manager": "danger"
    };
    return <Badge variant={variants[role] || "default"}>{role}</Badge>;
  };

  const columns = [
    {
      key: "createdAt",
      header: "Submitted",
      render: (v) => <span className="text-slate-400 text-sm">{new Date(v).toLocaleDateString()}</span>
    },
    {
      key: "role",
      header: "Category",
      render: (v) => getRoleBadge(v)
    },
    {
      key: "overallRating",
      header: "Overall Experience",
      render: (v) => (
        <div className="flex gap-0.5">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className={`w-3.5 h-3.5 ${i < v ? "fill-yellow-400 text-yellow-400" : "text-slate-700"}`} />
          ))}
        </div>
      )
    },
    {
      key: "npsScore",
      header: "NPS",
      render: (v) => (
        <span className={`font-bold ${v >= 9 ? "text-success-400" : v >= 7 ? "text-warning-400" : "text-red-400"}`}>
          {v}/10
        </span>
      )
    },
    {
      key: "qrUsed",
      header: "QR Used",
      render: (v) => v ? <Badge variant="success">Yes</Badge> : <Badge variant="default">No</Badge>
    },
    {
      key: "likedMost",
      header: "Feedback",
      render: (v, row) => (
        <div className="max-w-xs">
          <p className="text-sm text-white truncate font-medium">{v || "No comment"}</p>
          <p className="text-xs text-slate-500 truncate italic">{row.improveFuture}</p>
        </div>
      )
    },
    {
      key: "actions",
      header: "",
      render: (_, row) => (
        <Button variant="ghost" size="sm" icon={ExternalLink} onClick={() => setSelectedFeedback(row)}>
          View Detail
        </Button>
      )
    }
  ];

  return (
    <div id="admin_feedback_page" className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-base-alt backdrop-blur-md p-6 rounded-3xl border border-border shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary-500/10 border border-primary-500/20 rounded-2xl flex items-center justify-center shadow-cyanGlowSmall">
            <MessageSquare className="w-6 h-6 text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-main tracking-tight">Event Feedback</h1>
            <p className="text-muted text-sm">Analyze participant satisfaction for DIAC 2026</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="bg-base border-border rounded-xl px-4 py-2 text-main focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-all min-w-[200px]"
          >
            {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <Button 
            variant="outline" 
            icon={Settings} 
            onClick={() => setShowSetup(true)}
            className="border-primary-500/30 text-primary-400 hover:bg-primary-500/10"
          >
            Setup
          </Button>
          <Button variant="outline" icon={Download}>Export CSV</Button>
        </div>
      </div>

      {stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard 
            title="Net Promoter Score" 
            value={`${stats.nps.toFixed(1)}/10`} 
            icon={TrendingUp} 
            trend="+0.5 from last event"
            variant="primary" 
          />
          <StatsCard 
            title="Overall Experience" 
            value={`${stats.avgOverall.toFixed(1)} / 5.0`} 
            icon={Star} 
            variant="warning" 
          />
          <StatsCard 
            title="Total Responses" 
            value={stats.total} 
            icon={Users} 
            variant="info" 
          />
          <StatsCard 
            title="QR Usage Rate" 
            value={`${Math.round((feedbacks.filter(f => f.qrUsed).length / feedbacks.length) * 100)}%`} 
            icon={QrCode} 
            variant="success" 
          />
        </div>
      ) : (
        <div className="bg-base-alt backdrop-blur-md p-8 rounded-3xl border border-dashed border-border flex flex-col items-center text-center space-y-4">
          <div className="w-16 h-16 bg-base rounded-2xl flex items-center justify-center text-muted mb-2">
            <Info className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-main">No Feedback Yet</h3>
            <p className="text-muted max-w-md mx-auto">
              Your feedback system is ready! Once you share the link and receive responses, 
              you'll see metrics like NPS and average experience here.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="primary" icon={Settings} onClick={() => setShowSetup(true)}>
              View Share Links
            </Button>
          </div>
        </div>
      )}

      <div className="bg-base border-border rounded-3xl border shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-border/50 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-6">
            <h2 className="text-lg font-bold text-main uppercase tracking-widest flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted" /> Responses
            </h2>
            <div className="flex bg-base-alt p-1 rounded-xl border border-border">
              {["All", ...roles].map(r => (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    roleFilter === r ? "bg-primary-500 text-white shadow-cyanGlowSmall" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted group-focus-within:text-primary-400 transition-colors" />
            <input 
              type="text" 
              placeholder="Search feedback..." 
              className="bg-base-alt border border-border rounded-xl pl-10 pr-4 py-2 text-sm text-main focus:outline-none focus:ring-2 focus:ring-primary-500/20 w-64 transition-all"
            />
          </div>
        </div>

        <DataTable 
          columns={columns} 
          data={filteredFeedbacks} 
          loading={loading}
          pagination={true}
          pageSize={10}
        />
      </div>

      <AnimatePresence>
        {selectedFeedback && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedFeedback(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-base border border-border p-8 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary-500/10 rounded-2xl flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-primary-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-main">Feedback Detail</h2>
                    <p className="text-muted text-sm">Submitted on {new Date(selectedFeedback.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedFeedback(null)} className="text-slate-500 hover:text-white transition-colors">
                  Close ✕
                </button>
              </div>

              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-base-alt rounded-2xl border border-border space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-primary-400">Category</span>
                    <div className="flex pt-1">{getRoleBadge(selectedFeedback.role)}</div>
                  </div>
                  <div className="p-4 bg-base-alt rounded-2xl border border-border space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-yellow-400">Overall Rating</span>
                    <div className="flex gap-0.5 pt-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-4 h-4 ${i < selectedFeedback.overallRating ? "fill-yellow-400 text-yellow-400" : "text-slate-700"}`} />
                      ))}
                    </div>
                  </div>
                  <div className="p-4 bg-base-alt rounded-2xl border border-border space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-success-400">NPS Score</span>
                    <p className="text-xl font-bold text-main">{selectedFeedback.npsScore}/10</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2">Experience Ratings</h3>
                    <div className="space-y-4">
                      {[
                        { label: "Organisation", value: selectedFeedback.organisationRating, max: 5, isText: true },
                        { label: "Competition", value: selectedFeedback.competitionRating, max: 5 },
                        { label: "Venue", value: selectedFeedback.venueRating, max: 5 },
                        { label: "Communication", value: selectedFeedback.communicationRating, max: 5 }
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-sm text-slate-400">{item.label}</span>
                          <div className="flex gap-0.5">
                            {item.isText ? (
                              <Badge variant="info">{item.value}</Badge>
                            ) : (
                              [...Array(item.max)].map((_, j) => (
                                <Star key={j} className={`w-3 h-3 ${j < item.value ? "fill-primary-400 text-primary-400" : "text-slate-800"}`} />
                              ))
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 pb-2">QR System Experience</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">QR Code Used</span>
                        <Badge variant={selectedFeedback.qrUsed ? "success" : "default"}>{selectedFeedback.qrUsed ? "Yes" : "No"}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Ease of Use</span>
                        <div className="flex gap-0.5">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className={`w-3 h-3 ${i < selectedFeedback.qrEase ? "fill-primary-400 text-primary-400" : "text-slate-800"}`} />
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Value of System</span>
                        <Badge variant="info">{selectedFeedback.qrValue}</Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  {[
                    { label: "What was liked most?", value: selectedFeedback.likedMost },
                    { label: "What can be improved for future?", value: selectedFeedback.improveFuture },
                    { label: "System Improvement Suggestions", value: selectedFeedback.systemImprovement },
                    { label: "Additional Comments", value: selectedFeedback.additionalComments }
                  ].map((item, i) => item.value && (
                    <div key={i} className="space-y-2">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">{item.label}</h4>
                      <div className="p-4 bg-slate-950/50 rounded-xl border border-white/5 text-white text-sm leading-relaxed whitespace-pre-wrap">
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showSetup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSetup(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-slate-900 border border-white/10 p-8 rounded-3xl shadow-2xl w-full max-xl"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary-500/10 rounded-xl flex items-center justify-center">
                    <Settings className="w-5 h-5 text-primary-400" />
                  </div>
                  <h2 className="text-xl font-bold text-white">Feedback Setup</h2>
                </div>
                <button onClick={() => setShowSetup(false)} className="text-slate-500 hover:text-white transition-colors text-sm">
                  Close ✕
                </button>
              </div>

              <div className="space-y-6">
                <div className="p-4 bg-slate-800/50 rounded-2xl border border-white/5 space-y-1">
                  <span className="text-xs font-bold text-primary-400 uppercase tracking-widest">Active Event</span>
                  <p className="text-lg font-bold text-white">{events.find(e => e.id === selectedEventId)?.name || "N/A"}</p>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-400">Public Feedback Link</label>
                  <div className="flex gap-2">
                    <div className="bg-slate-950 px-4 py-3 rounded-xl border border-white/5 text-slate-300 text-sm font-mono flex-1 truncate">
                      {window.location.origin}/feedback/{events.find(e => e.id === selectedEventId)?.slug || "your-event-slug"}
                    </div>
                    <Button
                      variant="outline"
                      icon={Copy}
                      onClick={() => {
                        const ev = events.find(e => e.id === selectedEventId);
                        navigator.clipboard.writeText(`${window.location.origin}/feedback/${ev?.slug || ""}`);
                        toast.success("Link copied to clipboard!");
                      }}
                    />
                    <Button
                      variant="primary"
                      icon={ExternalLink}
                      onClick={() => {
                        const ev = events.find(e => e.id === selectedEventId);
                        window.open(`/feedback/${ev?.slug || ""}`, "_blank");
                      }}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 flex items-center gap-3 text-slate-400 text-sm">
                  <QrCode className="w-4 h-4 flex-shrink-0" />
                  <span>To customise questions, go to <strong className="text-white">QR System → Feedback Form</strong> tab.</span>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
