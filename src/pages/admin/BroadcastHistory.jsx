import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Radio, Globe, Users, Trash2, RefreshCw,
  ChevronDown, ChevronUp, Search, Calendar, MessageSquare, X, Edit2, Check
} from "lucide-react";
import { BroadcastV2API } from "../../lib/broadcastApi";
import { EventsAPI } from "../../lib/storage";
import { supabase } from "../../lib/supabase";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../contexts/AuthContext";

export default function BroadcastHistory() {
  const toast = useToast();
  const [broadcasts, setBroadcasts] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterEvent, setFilterEvent] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [recipientCache, setRecipientCache] = useState({});
  const [deleting, setDeleting] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editMessage, setEditMessage] = useState("");
  const { canAccessEvent, isSuperAdmin } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allBroadcasts, allEvents] = await Promise.all([
        BroadcastV2API.getAll(),
        EventsAPI.getAll()
      ]);
      
      // Client-side join for event names
      const enhanced = allBroadcasts
        .filter(b => isSuperAdmin || !b.eventId || canAccessEvent(b.eventId))
        .map(b => {
          const ev = allEvents.find(e => e.id === b.eventId);
          return {
            ...b,
            eventName: ev ? ev.name : (b.type === "global" ? "Global" : "Unknown Event"),
            // Ensure recipientIds/athleteId consistency
            recipientIds: b.athleteId ? [b.athleteId] : []
          };
        });

      setBroadcasts(enhanced);
      setEvents(allEvents.filter(e => canAccessEvent(e.id)));
    } catch (err) {
      console.error(err);
      toast.error("Failed to load broadcasts: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadRecipients = async (broadcast) => {
    if (broadcast.type !== "athlete" || !broadcast.recipientIds?.length) return;
    if (recipientCache[broadcast.id]) return; // already loaded

    try {
      const { data } = await supabase
        .from("accreditations")
        .select("id, first_name, last_name, club, role")
        .in("id", broadcast.recipientIds);
      setRecipientCache(prev => ({ ...prev, [broadcast.id]: data || [] }));
    } catch (err) {
      console.error("Failed to load recipients:", err);
    }
  };

  const handleExpand = (broadcast) => {
    const newId = expandedId === broadcast.id ? null : broadcast.id;
    setExpandedId(newId);
    if (newId && broadcast.type === "athlete") {
      loadRecipients(broadcast);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this broadcast from history? It will be soft-deleted and athletes will no longer see it.")) return;
    setDeleting(id);
    try {
      await BroadcastV2API.delete(id);
      setBroadcasts(prev => prev.filter(b => b.id !== id));
      toast.success("Broadcast removed from history.");
    } catch (err) {
      toast.error("Failed to delete: " + err.message);
    } finally {
      setDeleting(null);
    }
  };

  const startEdit = (broadcast) => {
    setEditingId(broadcast.id);
    setEditMessage(broadcast.message);
    if (expandedId !== broadcast.id) {
      handleExpand(broadcast);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditMessage("");
  };

  const saveEdit = async (id) => {
    if (!editMessage.trim()) return toast.error("Message cannot be empty");
    try {
      await BroadcastV2API.update(id, editMessage);
      setBroadcasts(prev => prev.map(b => b.id === id ? { ...b, message: editMessage } : b));
      toast.success("Broadcast message updated successfully");
      setEditingId(null);
    } catch (err) {
      toast.error("Failed to update: " + err.message);
    }
  };

  const filtered = broadcasts.filter(b => {
    if (filterEvent !== "all" && b.eventId !== filterEvent) return false;
    if (filterType !== "all" && b.type !== filterType) return false;
    if (search && !b.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const globalCount = broadcasts.filter(b => b.type === "global").length;
  const athleteCount = broadcasts.filter(b => b.type === "athlete").length;
  const totalRecipients = broadcasts.filter(b => b.type === "athlete").reduce((sum, b) => sum + (b.recipientIds?.length || 0), 0);

  return (
    <div id="broadcast-history-page" className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-h1 text-whiteElite mb-1 uppercase tracking-tight">Signal Dispatch</h1>
        <p className="text-sm text-slate-500 font-medium tracking-wide uppercase opacity-70">
          Global and Targeted Communication Archive
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={Radio} label="Total Broadcasts" value={broadcasts.length} color="blue" />
        <StatCard icon={Globe} label="Global Messages" value={globalCount} color="emerald" />
        <StatCard icon={Users} label="Athletes Reached" value={totalRecipients} color="orange" />
      </div>

      {/* Filters */}
      <div className="apex-glass p-2 flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search transmission logs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-whiteElite placeholder-slate-600 focus:border-primary outline-none transition-all text-xs font-mono uppercase tracking-widest"
          />
        </div>

        <select
          value={filterEvent}
          onChange={e => setFilterEvent(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-primary transition-all min-w-[180px]"
        >
          <option value="all">Frequency: All Events</option>
          {events.map(e => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>

        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest outline-none focus:border-primary transition-all"
        >
          <option value="all">Type: All</option>
          <option value="global">Global Only</option>
          <option value="athlete">Athlete Only</option>
        </select>

        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-500 hover:text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border border-white/5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Sys-Refresh
        </button>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          Showing <span className="text-white font-bold">{filtered.length}</span> of {broadcasts.length} broadcasts
        </p>
      </div>

      {/* Broadcast List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-800 border border-gray-700 rounded-xl py-16 text-center">
          <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm font-medium">No broadcasts found</p>
          <p className="text-gray-600 text-xs mt-1">Try adjusting your filters or send a broadcast from the QR System page</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden"
            >
              {/* Header row */}
              <div className="flex items-center gap-4 px-5 py-4">
                {/* Type badge */}
                <div className={`flex-shrink-0 p-2.5 rounded-xl ${
                  b.type === "global"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-orange-500/10 text-orange-400"
                }`}>
                  {b.type === "global" ? <Globe className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                      b.type === "global"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                    }`}>
                      {b.type === "global" ? "Event Broadcast" : "Athlete Broadcast"}
                    </span>
                    {b.eventName && (
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {b.eventName}
                      </span>
                    )}
                    {b.type === "athlete" && (
                      <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                        {b.recipientIds?.length || 0} recipients
                      </span>
                    )}
                    {b.type === "global" && b.targets?.length > 0 && (
                      <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                        → {b.targets.join(", ")}
                      </span>
                    )}
                  </div>
                  <p className="text-white text-sm font-medium leading-snug line-clamp-1">
                    {editingId === b.id ? "Editing message..." : b.message}
                  </p>
                  <p className="text-gray-500 text-[10px] font-bold uppercase tracking-wider mt-1">
                    {new Date(b.createdAt).toLocaleString("en-US", {
                      year: "numeric", month: "short", day: "numeric",
                      hour: "numeric", minute: "2-digit", hour12: true
                    })}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {editingId === b.id ? (
                    <>
                      <button
                        onClick={() => saveEdit(b.id)}
                        className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-all"
                        title="Save changes"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-all"
                        title="Cancel edit"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => startEdit(b)}
                        className="p-2 rounded-lg bg-gray-700 hover:bg-blue-500/20 text-gray-500 hover:text-blue-400 transition-all"
                        title="Edit message"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleExpand(b)}
                        className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-all"
                        title="View details"
                      >
                        {expandedId === b.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDelete(b.id)}
                        disabled={deleting === b.id}
                        className="p-2 rounded-lg bg-gray-700 hover:bg-red-900/40 text-gray-500 hover:text-red-400 transition-all"
                        title="Remove broadcast"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Expanded details */}
              {expandedId === b.id && (
                <div className="border-t border-gray-700 bg-gray-900/50 px-5 py-4 space-y-4">
                  {/* Full message */}
                  <div>
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Full Message</p>
                    {editingId === b.id ? (
                      <textarea
                        value={editMessage}
                        onChange={(e) => setEditMessage(e.target.value)}
                        className={`w-full p-4 rounded-xl border text-sm text-white/90 leading-relaxed font-medium focus:outline-none focus:ring-1 focus:ring-blue-500/50 resize-y min-h-[100px] ${
                          b.type === "global"
                            ? "bg-emerald-500/5 border-emerald-500/30 text-emerald-100"
                            : "bg-orange-500/5 border-orange-500/30 text-orange-100"
                        }`}
                        placeholder="Update broadcast message..."
                      />
                    ) : (
                      <div className={`p-4 rounded-xl border text-sm text-white/90 leading-relaxed font-medium whitespace-pre-wrap ${
                        b.type === "global"
                          ? "bg-emerald-500/5 border-emerald-500/10"
                          : "bg-orange-500/5 border-orange-500/10"
                      }`}>
                        {b.message}
                      </div>
                    )}
                  </div>

                  {/* Recipients (athlete broadcasts only) */}
                  {b.type === "athlete" && (
                    <div>
                      <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">
                        Recipients ({b.recipientIds?.length || 0})
                      </p>
                      {recipientCache[b.id] ? (
                        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                          {recipientCache[b.id].map(r => (
                            <div
                              key={r.id}
                              className="flex items-center gap-1.5 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5"
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-orange-400/60" />
                              <span className="text-xs text-white font-bold">{r.first_name} {r.last_name}</span>
                              <span className="text-[10px] text-gray-500 font-bold">{r.club ? `· ${r.club}` : ""}</span>
                            </div>
                          ))}
                          {b.recipientIds.length > (recipientCache[b.id]?.length || 0) && (
                            <div className="flex items-center px-3 py-1.5 text-xs text-gray-500 font-bold">
                              +{b.recipientIds.length - recipientCache[b.id].length} more
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-gray-500 text-xs animate-pulse">
                          <div className="w-3 h-3 border border-gray-500 border-t-transparent rounded-full animate-spin" />
                          Loading recipients...
                        </div>
                      )}
                    </div>
                  )}

                  {/* Targets (global broadcasts only) */}
                  {b.type === "global" && (
                    <div>
                      <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Target Audience</p>
                      <div className="flex flex-wrap gap-2">
                        {b.targets?.length > 0 ? b.targets.map(t => (
                          <span key={t} className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-bold">
                            {t}
                          </span>
                        )) : (
                          <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-bold">
                            Everyone
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  const colors = {
    blue: "bg-primary-500/5 border-primary-500/20 text-primary shadow-[0_0_15px_-5px_rgba(34,211,238,0.2)]",
    emerald: "bg-emerald-500/5 border-emerald-500/20 text-emerald-400",
    orange: "bg-amber-500/5 border-amber-500/20 text-amber-400",
  };
  return (
    <div className={`apex-glass ${colors[color]} p-5 transition-all hover:scale-[1.02] duration-300`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</p>
        <Icon className="w-3.5 h-3.5 text-current opacity-60" />
      </div>
      <p className="font-h1 text-whiteElite">{value}</p>
    </div>
  );
}
