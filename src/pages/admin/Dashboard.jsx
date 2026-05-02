import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import {
  Users,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  TrendingUp,
  ArrowRight,
  Activity,
  RefreshCw,
  MapPin,
  Plus,
  Send,
  QrCode,
  FileText,
  TrendingDown,
  ChevronRight,
  Bell,
  Search,
  MoreHorizontal
} from "lucide-react";
import { 
  AreaChart, Area, 
  LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell,
  PieChart, Pie, Legend
} from "recharts";
import StatsCard from "../../components/ui/StatsCard";
import Card, { CardHeader, CardContent } from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import { useAuth } from "../../contexts/AuthContext";
import { EventsAPI, AccreditationsAPI, AuditAPI, ZonesAPI } from "../../lib/storage";
import { AttendanceAPI } from "../../lib/attendanceApi";
import { formatDate, cn } from "../../lib/utils";

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalAccreditations: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  });
  const [recentAccreditations, setRecentAccreditations] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [events, setEvents] = useState([]);
  const [eventCounts, setEventCounts] = useState({});
  const [trends, setTrends] = useState({
    events: [30, 45, 40, 60, 50, 75, 65, 80, 90],
    accreditations: [25, 40, 35, 55, 45, 70, 60, 85, 95],
    pending: [60, 50, 45, 40, 35, 30, 25, 20, 15],
    approved: [20, 35, 30, 50, 40, 65, 55, 80, 90],
    rejected: [5, 8, 4, 10, 6, 12, 7, 9, 11]
  });
  const [loading, setLoading] = useState(true);
  const [liveScanLogs, setLiveScanLogs] = useState([]);
  const [allZones, setAllZones] = useState([]);
  const [eventAccreditations, setEventAccreditations] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("all");
  const { user, canAccessEvent, isSuperAdmin } = useAuth();

  useEffect(() => {
    let interval;
    const fetchLiveStats = async () => {
      try {
        if (isSuperAdmin) {
          const targetEventId = selectedEventId === "all" ? null : selectedEventId;
          const [logs, accreditations] = await Promise.all([
            AttendanceAPI.getScanLogsByEvent(targetEventId),
            AccreditationsAPI.getByEventId(targetEventId, { status: 'approved' })
          ]);
          setLiveScanLogs(logs || []);
          setEventAccreditations(accreditations || []);
        } else if (user?.allowedEventIds?.length > 0) {
          // Specific event stats for Sub Admin
          const [logs, accreditations] = await Promise.all([
            AttendanceAPI.getScanLogsByEvent(user.allowedEventIds[0]),
            AccreditationsAPI.getByEventId(user.allowedEventIds[0], { status: 'approved' })
          ]);
          setLiveScanLogs(logs || []);
          setEventAccreditations(accreditations || []);
        }
      } catch (err) {
        console.error("Live fetch error:", err);
      }
    };

    fetchLiveStats();
    // APX-PERF: Increased interval from 20s to 60s to reduce background overhead
    interval = setInterval(fetchLiveStats, 60000);
    return () => clearInterval(interval);
  }, [isSuperAdmin, user?.allowedEventIds, selectedEventId]);

  const liveAreaSummary = useMemo(() => {
    const summary = {};
    // Pre-fill all zones with 0 to ensure they always show up
    allZones.forEach(z => {
      if (z.name) summary[z.name] = 0;
    });

    liveScanLogs.forEach(log => {
      const label = log.device_label || 'Other';
      
      let matchedLabel = label;
      const existingKey = Object.keys(summary).find(k => k.toLowerCase() === label.toLowerCase());
      if (existingKey) {
        matchedLabel = existingKey;
      }
      
      summary[matchedLabel] = (summary[matchedLabel] || 0) + 1;
    });
    return summary;
  }, [liveScanLogs, allZones]);

  // APX-PERF: Pre-calculate counts to avoid O(N^2) complexity in memo blocks
  const accreditationZoneMap = useMemo(() => {
    const map = new Map();
    eventAccreditations.forEach(acc => {
      if (!acc.zoneCode) return;
      const codes = Array.isArray(acc.zoneCode) ? acc.zoneCode : [acc.zoneCode];
      codes.forEach(code => {
        map.set(code, (map.get(code) || 0) + 1);
      });
    });
    return map;
  }, [eventAccreditations]);

  // Compute zone ratios: scanned unique vs allocated (Aggregated by name for Global View)
  const liveZoneRatios = useMemo(() => {
    const ratios = {};
    if (!allZones.length) return ratios;

    allZones.forEach(z => {
      if (!z.name) return;
      
      const normalizedName = z.name.toLowerCase();
      const codesForName = z.allCodes || [z.code];
      
      // APX-PERF: Use the pre-calculated map instead of filtering the whole array for every zone
      let allocated = 0;
      codesForName.forEach(code => {
        allocated += (accreditationZoneMap.get(code) || 0);
      });

      // Count unique athletes scanned at this zone label
      const uniqueScanned = new Set();
      liveScanLogs.forEach(log => {
        const label = log.device_label || '';
        if (label.toLowerCase() === normalizedName && log.athlete_id) {
          uniqueScanned.add(log.athlete_id);
        }
      });

      ratios[z.name] = {
        count: liveAreaSummary[z.name] || 0,
        scanned: uniqueScanned.size,
        allocated: allocated
      };
    });
    return ratios;
  }, [liveScanLogs, allZones, accreditationZoneMap, liveAreaSummary]);

  // Compute role distribution for the specific event
  const subAdminRoleDist = useMemo(() => {
    const dist = {};
    eventAccreditations.forEach(acc => {
      const role = acc.role || 'Other';
      dist[role] = (dist[role] || 0) + 1;
    });
    const colors = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'];
    return Object.entries(dist)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ 
        name, 
        value, 
        color: colors[i % colors.length] 
      }));
  }, [eventAccreditations]);

  useEffect(() => {
    // Only load data if we know the user's status (Super Admin or we have their event IDs)
    if (isSuperAdmin || user?.allowedEventIds !== undefined) {
      loadData();
    }
  }, [user?.allowedEventIds, isSuperAdmin, selectedEventId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const allowedEventIds = user?.allowedEventIds || [];
      const targetEventId = isSuperAdmin 
        ? (selectedEventId === "all" ? null : selectedEventId) 
        : (allowedEventIds[0] || null);
      
      const targetEventIds = targetEventId ? [targetEventId] : (isSuperAdmin ? null : allowedEventIds);

      const [eventsRes, statsRes, recentRes, auditRes, zonesRes] = await Promise.allSettled([
        EventsAPI.getAll(),
        AccreditationsAPI.getStats(targetEventIds),
        AccreditationsAPI.getRecent(100, targetEventIds),
        AuditAPI.getRecent(10),
        isSuperAdmin 
          ? (targetEventId ? ZonesAPI.getByEventId(targetEventId) : ZonesAPI.getAll())
          : Promise.all(allowedEventIds.map(id => ZonesAPI.getByEventId(id))).then(res => res.flat())
      ]);

      let allEvents = [];
      let accStats = { total: 0, pending: 0, approved: 0, rejected: 0 };

      if (eventsRes.status === "fulfilled") {
        allEvents = eventsRes.value.filter(e => canAccessEvent(e.id));
        setEvents(allEvents);
        
        // Update counts by event
        const eventIds = allEvents.map(e => e.id);
        AccreditationsAPI.getCountsByEventIds(eventIds)
          .then(counts => setEventCounts(counts))
          .catch(err => console.error("Event counts error:", err));
      } else {
        console.error("Dashboard source (EventsAPI.getAll) failed:", eventsRes.reason);
      }

      if (statsRes.status === "fulfilled") {
        accStats = statsRes.value;
      } else {
        console.error("Dashboard source (AccreditationsAPI.getStats) failed:", statsRes.reason);
      }

      // Set stats after potentially getting both events and accStats
      setStats({
        totalEvents: allEvents.length,
        totalAccreditations: accStats.total,
        pending: accStats.pending,
        approved: accStats.approved,
        rejected: accStats.rejected
      });

      if (recentRes.status === "fulfilled") {
        const recentAcc = recentRes.value;
        setRecentAccreditations(recentAcc.slice(0, 5));

        // Derive trends from real data
        const last9Days = [...Array(9)].map((_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (8 - i));
          return d.toISOString().split('T')[0];
        });

        const accTrend = last9Days.map(date => {
          const count = recentAcc.filter(a => a.createdAt?.startsWith(date)).length;
          return Math.min(20 + (count * 15), 100);
        });

        setTrends(prev => ({
          ...prev,
          accreditations: accTrend,
          approved: accTrend.map(v => v * 0.8),
          pending: accTrend.map(v => v * 0.2)
        }));
      } else {
        console.error("Dashboard source (AccreditationsAPI.getRecent) failed:", recentRes.reason);
      }

      if (auditRes.status === "fulfilled") {
        setRecentActivity(auditRes.value);
      } else {
        console.error("Dashboard source (AuditAPI.getRecent) failed:", auditRes.reason);
      }

      if (zonesRes.status === "fulfilled") {
        // deduplicate zones by name but KEEP ALL CODES for global aggregation
        const uniqueZones = [];
        const seen = new Map(); // name -> index in uniqueZones
        
        zonesRes.value.forEach(z => {
          if (!z.name) return;
          const name = z.name.toLowerCase();
          
          if (!seen.has(name)) {
            seen.set(name, uniqueZones.length);
            uniqueZones.push({
              ...z,
              allCodes: [z.code]
            });
          } else {
            const index = seen.get(name);
            if (z.code && !uniqueZones[index].allCodes.includes(z.code)) {
              uniqueZones[index].allCodes.push(z.code);
            }
          }
        });
        setAllZones(uniqueZones);
      } else {
        console.error("Dashboard source (ZonesAPI) failed:", zonesRes.reason);
      }

    } catch (error) {
      console.error("Dashboard massive failure:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (action) => {
    switch (action) {
      case "accreditation_approved":
        return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case "accreditation_rejected":
        return <XCircle className="w-5 h-5 text-rose-400" />;
      case "accreditation_submitted":
        return <Clock className="w-5 h-5 text-amber-400" />;
      case "zone_created":
      case "event_created":
        return <Plus className="w-5 h-5 text-indigo-400" />;
      default:
        return <Activity className="w-5 h-5 text-sky-400" />;
    }
  };

  const EnterpriseStatsCard = ({ title, value, change, changeType, icon: Icon, color, data }) => (
    <Card className="bg-base border border-border shadow-md hover:shadow-lg transition-all duration-300">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{title}</p>
            <p className="text-3xl font-bold text-main tracking-tight">{value.toLocaleString()}</p>
            {change && (
              <div className={cn(
                "flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-md w-fit mt-3",
                changeType === "positive" ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
              )}>
                {changeType === "positive" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {change}
              </div>
            )}
          </div>
          <div className={cn("p-3 rounded-xl bg-base-alt border border-border", color || "text-primary")}>
            <Icon className="w-6 h-6" strokeWidth={2} />
          </div>
        </div>
        {data && data.length > 0 && (
          <div className="h-10 mt-6 -mx-1 opacity-50">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.map((v, i) => ({ v, i }))}>
                <Area 
                  type="monotone" 
                  dataKey="v" 
                  stroke={changeType === "positive" ? "#10b981" : "#6366f1"} 
                  fill={changeType === "positive" ? "#10b981" : "#6366f1"} 
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const pieData = [
    { name: 'Approved', value: stats.approved, color: '#10b981' },
    { name: 'Pending', value: stats.pending, color: '#f59e0b' },
    { name: 'Rejected', value: stats.rejected, color: '#f43f5e' }
  ];

  const attendanceData = useMemo(() => {
    return trends.accreditations.map((v, i) => ({
      day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Next', 'Future'][i] || '—',
      checkins: Math.floor(v * 1.5)
    }));
  }, [trends.accreditations]);

  if (loading) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-border border-t-primary rounded-full animate-spin"></div>
          <Activity className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-primary" />
        </div>
        <p className="text-xs font-bold text-muted uppercase tracking-[0.4em]">Optimizing Dashboard Hub</p>
      </div>
    );
  }


  const EventSpecificContent = () => (
    <div className="space-y-4 mt-2">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Accreditations', value: stats.totalAccreditations, color: 'text-indigo-400', icon: Users, iconBg: 'bg-indigo-500/5 border-indigo-500/10', data: trends.accreditations },
          { label: 'Pending Review', value: stats.pending, color: 'text-amber-400', icon: Clock, iconBg: 'bg-amber-500/5 border-amber-500/10', data: trends.accreditations.map(v => Math.floor(v * 0.1)), badge: stats.pending > 0 ? 'ACTION' : null },
          { label: 'Approved Users', value: stats.approved, color: 'text-emerald-400', icon: CheckCircle, iconBg: 'bg-emerald-500/5 border-emerald-500/10', data: trends.approved },
          { label: 'Live Operations', value: liveScanLogs.length, color: 'text-sky-400', icon: Activity, iconBg: 'bg-sky-500/5 border-sky-500/10', data: trends.events }
        ].map(({ label, value, color, icon: Icon, iconBg, data, badge }) => (
          <Card key={label} className="bg-slate-900/40 border border-white/5 shadow-xl hover:border-white/10 transition-all overflow-hidden group">
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-2">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 group-hover:text-indigo-400 transition-colors leading-none">{label}</p>
                  <p className="text-3xl font-bold text-white tracking-tight leading-tight mt-1">{value.toLocaleString()}</p>
                  {badge && <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-500 text-[8px] font-bold uppercase tracking-widest mt-2 border border-rose-500/20">{badge}</span>}
                </div>
                <div className={cn("p-2.5 rounded-xl border transition-all", iconBg, color, "group-hover:bg-opacity-20")}>
                  <Icon className="w-5 h-5" strokeWidth={1.5} />
                </div>
              </div>
              <div className="h-8 -mx-1 opacity-20 group-hover:opacity-40 transition-opacity">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(data || [0,0,0,0,0]).map((v, i) => ({ v, i }))} barSize={3}>
                    <Bar dataKey="v" radius={[1, 1, 0, 0]} fill="currentColor" className={color} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-slate-900/40 border border-white/5 shadow-2xl overflow-hidden group">
        <CardHeader className="border-b border-white/5 py-2.5 px-5 flex items-center justify-between bg-white/[0.02]">
           <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-3">
             <MapPin className="w-3.5 h-3.5 text-sky-500" strokeWidth={2} /> Operational Capacity Flow
           </h3>
           <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest opacity-60">Real-time Zone Occupancy</span>
        </CardHeader>
        <CardContent className="p-4 max-h-[480px] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3.5 pt-1 pb-2">
            {allZones.map((zone, idx) => {
              const data = liveZoneRatios[zone.name] || { count: 0, scanned: 0, allocated: 0 };
              const perc = data.allocated > 0 ? Math.round((data.scanned / data.allocated) * 100) : (data.scanned > 0 ? 100 : 0);
              const cappedPerc = Math.min(perc, 100);
              return (
                 <div key={zone.id || zone.name} className="relative bg-slate-800/40 border border-white/5 p-3.5 rounded-2xl group/zone hover:border-indigo-500/30 transition-all flex flex-col justify-between h-[88px] shadow-lg overflow-hidden group">
                   <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover/zone:opacity-100 transition-opacity pointer-events-none" />
                   <div className="flex items-center justify-between min-w-0 relative z-10">
                     <span className="text-[9px] font-black uppercase tracking-tight text-slate-500 truncate group-hover/zone:text-white transition-colors">{zone.name}</span>
                     <span className={cn("text-[10px] font-black tracking-tighter", perc > 90 ? "text-rose-500 animate-pulse" : "text-emerald-400")}>{perc}%</span>
                   </div>
                   <div className="flex items-baseline gap-1 relative z-10 -mt-1">
                     <p className="text-2xl font-bold text-white tracking-tighter leading-none">{data.scanned}</p>
                     <sub className="text-[9px] font-bold text-slate-600 uppercase tracking-tighter">/ {data.allocated || 1}</sub>
                   </div>
                    <div className="w-full bg-slate-900/80 rounded-full h-[6px] overflow-hidden border border-white/5 relative z-10 mt-1.5">
                     <motion.div 
                       initial={{ width: 0 }}
                       animate={{ width: `${cappedPerc}%` }}
                       transition={{ duration: 1.2, delay: idx * 0.04 }}
                       className={cn(
                         "h-full rounded-full transition-all shadow-sm", 
                         perc > 0 
                           ? "bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.4)]" 
                           : "bg-emerald-500/10 border border-emerald-500/5"
                       )} 
                     />
                   </div>
                 </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Row 3 Segment: Chart + Audit Filtered */}
        <div className="lg:col-span-3 space-y-4 flex flex-col">


          <Card className="flex-1 bg-slate-900/40 border border-white/5 shadow-sm flex flex-col overflow-hidden">
             <CardHeader className="py-1.5 px-3 border-b border-white/5 flex items-center justify-between">
               <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Event Audit Feed</h3>
             </CardHeader>
             <CardContent className="p-0 flex-1 overflow-y-auto max-h-[300px] custom-scrollbar">
                <div className="divide-y divide-white/5">
                  {liveScanLogs.slice(-12).reverse().map((log, i) => (
                    <div key={log.id || i} className="px-4 py-3 flex items-center justify-between group hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shadow-sm transition-all group-hover:scale-110">
                           <Activity className="w-4 h-4 opacity-70" />
                        </div>
                        <div className="min-w-0">
                           <p className="text-sm font-black text-white truncate leading-tight group-hover:text-indigo-400 transition-colors uppercase tracking-tight">
                             {log.accreditations?.first_name ? `${log.accreditations.first_name} ${log.accreditations.last_name}` : 'Security Node'}
                           </p>
                           <p className="text-[11px] font-black text-indigo-400/60 uppercase tracking-widest leading-none mt-1 flex items-center gap-2">
                             <span className="px-1.5 py-0.5 bg-indigo-500/10 rounded border border-indigo-500/20">{log.accreditations?.role || 'Attendee'}</span>
                             <span>{log.device_label || 'Gate'}</span>
                           </p>
                        </div>
                      </div>
                      <div className="text-right">
                         <p className="text-[10px] font-black text-white opacity-90 uppercase leading-none">
                           {new Date(log.scanned_at || log.created_at || log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                         </p>
                         <p className="text-[6px] font-black text-emerald-500 uppercase tracking-[0.2em] mt-1">CONFIRMED</p>
                      </div>
                    </div>
                  ))}
                </div>
             </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4 flex flex-col">
          <Card className="flex-1 bg-slate-900/40 border border-white/5 shadow-sm flex flex-col overflow-hidden group">
            <CardHeader className="py-1.5 px-4 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Role Analytics</h3>
              <span className="text-[8px] font-bold text-indigo-400/50 uppercase tracking-widest">Live Census</span>
            </CardHeader>
            <CardContent className="p-4 flex-1 flex flex-col">
              {subAdminRoleDist.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-5 items-center gap-8 h-full">
                  {/* Visual Chart - Left Column (Centered Circular Gauge) */}
                  <div className="md:col-span-2 h-[220px] relative group/chart flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={subAdminRoleDist}
                          innerRadius={70}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                          stroke="none"
                        >
                          {subAdminRoleDist.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                        </Pie>
                        <Tooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-slate-900 border border-white/10 px-3 py-2 rounded-lg shadow-2xl">
                                  <p className="text-[10px] font-black text-white uppercase">{payload[0].name}</p>
                                  <p className="text-xl font-bold text-indigo-400">{payload[0].value}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <p className="text-4xl font-black text-white leading-none group-hover/chart:text-indigo-400 transition-all duration-300 transform group-hover/chart:scale-110">{eventAccreditations.length}</p>
                      <p className="text-[10px] font-black text-indigo-400/40 uppercase tracking-[0.3em] mt-2">Active</p>
                    </div>
                  </div>

                  {/* Role List - Right Column (Scrollable for Multi-Role scalability) */}
                  <div className="md:col-span-3 h-[240px] overflow-y-auto custom-scrollbar pr-3 space-y-4 pt-2">
                    {subAdminRoleDist.map((role, idx) => {
                      const total = eventAccreditations.length || 1;
                      const perc = Math.round((role.value / total) * 100);
                      return (
                        <div key={role.name} className="space-y-1.5 group/role">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-2.5 h-2.5 rounded-full shadow-[0_0_10px_currentColor]" style={{ backgroundColor: role.color, color: role.color }} />
                              <span className="text-[11px] font-black text-white/90 uppercase tracking-tight group-hover/role:text-indigo-400 transition-colors">{role.name}</span>
                            </div>
                            <div className="text-right flex items-baseline gap-2">
                              <span className="text-sm font-black text-white">{role.value}</span>
                              <span className="text-[9px] font-bold text-indigo-400/60 font-mono italic">{perc}%</span>
                            </div>
                          </div>
                          <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden border border-white/[0.02]">
                            <motion.div 
                              initial={{ width: 0 }} 
                              animate={{ width: `${perc}%` }} 
                              transition={{ duration: 1.2, delay: idx * 0.05 }} 
                              className="h-full rounded-full shadow-sm" 
                              style={{ backgroundColor: role.color }} 
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center space-y-3 opacity-30">
                  <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Aggregating Global Census...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  const SuperAdminLayout = () => (
    <div className="space-y-4 animate-in fade-in duration-700 overflow-hidden">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 py-2">
        <div className="flex flex-col shrink-0">
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            Operations Command
            <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full font-black tracking-widest uppercase shadow-sm">v4.0</span>
          </h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.25em] opacity-80 mt-1">
            {selectedEventId === "all" ? "Apex Sports Global Intelligence" : "Event-Specific Operational Hub"}
          </p>
        </div>
        
        {/* Event Selector - Refined & Premium */}
        <div className="flex-1 flex max-w-sm px-2">
          <div className="w-full relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500" />
            <div className="relative">
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 text-white font-bold uppercase tracking-wider text-[11px] rounded-xl px-5 py-3.5 pr-12 outline-none focus:border-indigo-500/40 transition-all appearance-none cursor-pointer shadow-2xl"
              >
                <option value="all">🌐 GLOBAL OVERVIEW (ALL EVENTS)</option>
                <option disabled>──────────</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    📍 {ev.name.toUpperCase()}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none text-indigo-400/50">
                 <ChevronRight className="w-4 h-4 rotate-90" />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-5 w-full md:w-auto">
          <div className="relative flex-1 md:w-72 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors" />
            <input 
              type="text" 
              placeholder="Search datasets or logs..." 
              className="w-full bg-slate-900/50 border border-white/5 focus:border-indigo-500/40 rounded-xl py-3 pl-11 pr-4 text-[11px] font-bold text-white shadow-inner outline-none placeholder:text-slate-600 transition-all"
            />
          </div>
          
          <div className="h-10 w-[1px] bg-white/5 mx-1" />

          <div className="flex items-center gap-4">
             <button className="relative p-3 bg-slate-900/50 border border-white/5 rounded-xl hover:bg-slate-800 transition-all group shadow-lg">
               <Bell className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
               <span className="absolute top-3 right-3 w-2 h-2 bg-rose-500 rounded-full border-2 border-slate-950 shadow-[0_0_10px_rgba(244,63,94,0.5)]"></span>
             </button>
             
             <div className="flex items-center gap-3 pl-2 group cursor-pointer">
               <div className="flex flex-col items-end">
                 <span className="text-[11px] font-bold text-white uppercase tracking-tight group-hover:text-indigo-400 transition-colors">{user?.email?.split('@')[0] || "Admin"}</span>
                 <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">Super Admin</span>
               </div>
               <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-800 to-slate-700 border border-white/10 flex items-center justify-center text-xs font-black text-indigo-400 shadow-xl group-hover:border-indigo-500/50 transition-all">
                 {user?.email?.[0]?.toUpperCase() || "S"}
               </div>
             </div>
          </div>
        </div>
      </div>

      {selectedEventId === "all" ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { title: 'Total Events', value: stats.totalEvents, icon: Calendar, color: 'text-sky-400', iconBg: 'bg-sky-500/5 border-sky-500/10', data: trends.events },
              { title: 'Total Accreditations', value: stats.totalAccreditations, icon: Users, iconBg: 'bg-indigo-500/5', color: 'text-indigo-400', data: trends.accreditations },
              { title: 'Approved', value: stats.approved, icon: CheckCircle, iconBg: 'bg-emerald-500/5', color: 'text-emerald-400', data: trends.approved },
              { title: 'Pending Review', value: stats.pending, icon: Clock, iconBg: 'bg-amber-500/5', color: 'text-amber-400', data: trends.accreditations.map(v => Math.floor(v * 0.05)), badge: stats.pending > 0 ? 'ACTION' : null },
              { title: 'Rejected', value: stats.rejected, icon: XCircle, iconBg: 'bg-rose-500/5', color: 'text-rose-400', data: trends.rejected },
            ].map(({ title, value, icon: Icon, color, iconBg, data, badge }) => (
              <Card key={title} className="bg-slate-900/40 border border-white/5 shadow-xl hover:border-indigo-500/20 transition-all duration-500 group overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="space-y-1 flex-1 min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 group-hover:text-indigo-400 transition-colors truncate leading-none">{title}</p>
                      <p className="text-3xl font-bold text-white tracking-tight leading-tight mt-1">{value.toLocaleString()}</p>
                      {badge && <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-500 text-[8px] font-bold uppercase tracking-widest mt-2 border border-rose-500/20">{badge}</span>}
                    </div>
                    <div className={cn("p-2.5 rounded-xl border transition-colors", iconBg, color, "border-white/5 group-hover:bg-opacity-20")}>
                      <Icon className="w-5 h-5" strokeWidth={1.5} />
                    </div>
                  </div>
                  {data && data.length > 0 && (
                    <div className="h-8 -mx-1 mt-2 opacity-20 group-hover:opacity-40 transition-opacity">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.map((v, i) => ({ v, i }))} barSize={3}>
                          <Bar dataKey="v" radius={[1, 1, 0, 0]} fill="currentColor" className={color} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            <Card className="lg:col-span-2 bg-slate-900/40 border border-white/5 shadow-xl flex flex-col group">
              <CardHeader className="p-4 flex items-center justify-between border-b border-white/5 bg-white/[0.02]">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Accreditation Spread</h3>
                <MoreHorizontal className="w-4 h-4 text-slate-500 hover:text-white cursor-pointer transition-colors" />
              </CardHeader>
              <CardContent className="flex-1 p-6 flex flex-col items-center justify-center relative">
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} innerRadius={70} outerRadius={95} paddingAngle={4} dataKey="value" stroke="none">
                        {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} opacity={0.8} className="hover:opacity-100 transition-opacity cursor-pointer" />)}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold' }} />
                      <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', paddingTop: '20px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                    <p className="text-4xl font-bold text-white tracking-tighter leading-none">{stats.totalAccreditations}</p>
                    <p className="text-[10px] font-bold text-indigo-400/60 uppercase tracking-[0.2em] mt-1.5">Total Hub</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-3 bg-slate-900/40 border border-white/5 shadow-xl overflow-hidden flex flex-col group">
              <CardHeader className="p-4 flex items-center justify-between border-b border-white/5 bg-white/[0.02]">
                <div className="flex flex-col">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Operations Intensity</h3>
                  <p className="text-[10px] text-slate-500 font-bold mt-0.5">Real-time attendance density per zone</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
                  <span className="text-[9px] font-bold text-emerald-500/80 tracking-widest uppercase">Live Telemetry</span>
                </div>
              </CardHeader>
              <CardContent className="p-6 flex-1 overflow-y-auto max-h-[460px] custom-scrollbar">
                <div className="grid gap-6">
                  {allZones.map((zone, i) => {
                    const zoneData = liveZoneRatios[zone.name] || { count: 0, scanned: 0, allocated: 0 };
                    const ratio = zoneData.allocated > 0 ? (zoneData.scanned / zoneData.allocated) * 100 : (zoneData.scanned > 0 ? 100 : 0);
                    const cappedRatio = Math.min(ratio, 100);
                    return (
                      <div key={zone.id || i} className="space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={cn("w-2 h-2 rounded-full", ratio > 0 ? "bg-emerald-500 shadow-[0_0_10px_#10b981]" : "bg-slate-700")} />
                            <span className="text-[11px] font-bold text-white uppercase tracking-tight">{zone.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="text-xs font-bold text-white tracking-tight">{zoneData.scanned}</span>
                              <span className="text-[10px] font-bold text-slate-500 mx-1">/</span>
                              <span className="text-[10px] font-bold text-slate-500">{zoneData.allocated || 0}</span>
                            </div>
                            <div className={cn("px-2 py-0.5 rounded text-[10px] font-black tracking-tighter", ratio > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-800/50 text-slate-500")}>
                              {Math.round(ratio)}%
                            </div>
                          </div>
                        </div>
                        <div className="h-[6px] w-full bg-slate-800/40 rounded-full overflow-hidden border border-white/5 shadow-inner">
                          <motion.div 
                            initial={{ width: 0 }} 
                            animate={{ width: `${cappedRatio}%` }} 
                            transition={{ duration: 1.5, ease: "easeOut", delay: i * 0.05 }} 
                            className={cn(
                              "h-full rounded-full shadow-[0_0_10px_rgba(16,185,129,0.3)] bg-gradient-to-r from-emerald-600 to-emerald-400"
                            )} 
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="bg-slate-900/40 border border-white/5 shadow-xl flex flex-col overflow-hidden group">
              <CardHeader className="p-4 flex items-center justify-between border-b border-white/5 bg-white/[0.02]">
                <div className="flex flex-col">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Recent Applications</h3>
                  <p className="text-[10px] text-slate-500 font-bold mt-0.5">Latest queue for verification</p>
                </div>
                <Link to="/admin/accreditations" className="text-[10px] font-bold text-indigo-400 hover:text-white uppercase tracking-widest flex items-center gap-1.5 transition-colors">VIEW QUEUE <ArrowRight className="w-3.5 h-3.5" /></Link>
              </CardHeader>
              <CardContent className="p-0 flex-1 overflow-y-auto custom-scrollbar min-h-[300px]">
                <div className="divide-y divide-white/5">
                  {recentAccreditations.slice(0, 5).map((acc) => (
                    <div key={acc.id} className="px-5 py-3.5 flex items-center gap-4 group/row hover:bg-white/[0.02] transition-colors">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 border border-white/5 flex items-center justify-center text-xs font-bold text-indigo-400">{(acc.firstName || 'U')[0].toUpperCase()}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold text-white truncate uppercase tracking-tight">{acc.firstName || ''} {acc.lastName || ''}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{acc.role || 'Attendee'}</p>
                      </div>
                      <div className={cn('text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded border shadow-inner shrink-0', acc.status === 'approved' ? 'text-emerald-500 border-emerald-500/20 bg-emerald-500/5' : 'text-amber-500 border-amber-500/20 bg-amber-500/5')}>{acc.status || 'pending'}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/40 border border-white/5 shadow-xl overflow-hidden group">
              <CardHeader className="p-4 flex items-center justify-between border-b border-white/5 bg-white/[0.02]">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Global Activity</h3>
                <Link to="/admin/audit" className="p-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg border border-white/5"><ArrowRight className="w-3.5 h-3.5 text-indigo-400" /></Link>
              </CardHeader>
              <CardContent className="p-0 min-h-[300px]">
                <div className="divide-y divide-white/5">
                  {recentActivity.slice(0, 5).map((log) => (
                    <div key={log.id} className="p-4 flex items-start gap-4">
                      <div className="mt-1 p-2 bg-slate-800 border border-white/5 rounded-xl">{getActivityIcon(log.action)}</div>
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-[13px] font-bold text-white truncate uppercase tracking-tight">{log.action.replace(/_/g, " ")}</p>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-800/50 px-2 py-0.5 rounded border border-white/5">{log.userName.split('@')[0]}</span>
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{formatDate(log.timestamp, "HH:mm")}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/40 border border-white/5 shadow-xl overflow-hidden flex flex-col group">
              <CardHeader className="p-4 flex items-center justify-between border-b border-white/5 bg-white/[0.02]">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Attendance Velocity</h3>
              </CardHeader>
              <CardContent className="flex-1 p-4 min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={attendanceData}>
                    <defs><linearGradient id="colorVelocity" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: '700' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: '700' }} width={30} />
                    <Area type="monotone" dataKey="checkins" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorVelocity)" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <EventSpecificContent />
      )}
    </div>
  );

  const ActionLink = ({ icon: Icon, label, to }) => (
    <Link to={to} className="flex flex-col items-center justify-center p-5 rounded-xl border border-border bg-base-alt hover:bg-border hover:shadow-md transition-all gap-3 group">
      <div className="p-3 bg-base shadow-sm border border-border rounded-xl text-muted group-hover:text-primary transition-colors">
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-[9px] font-black text-muted uppercase tracking-widest group-hover:text-main transition-colors">{label}</span>
    </Link>
  );

  const SubAdminLayout = () => (
    <div className="space-y-4 mt-1 pb-1">
      <div className="flex items-center justify-between px-2 mb-2">
        <div className="flex items-center gap-5">
          <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.1)]">
            <Activity className="w-6 h-6 text-emerald-500 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <h2 className="text-3xl font-bold uppercase text-white tracking-tight leading-none">Live Telemetry Center</h2>
            <div className="flex items-center gap-3 mt-1.5">
              <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 font-bold text-[10px] tracking-widest">
                SYSTEM ONLINE
              </Badge>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Operational Intelligence Flow</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
           <div className="flex flex-col items-end">
             <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest leading-none mb-1">Data Pipeline Sync</span>
             <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest leading-none">20.0s OFFSET</span>
           </div>
           <button onClick={loadData} className="w-11 h-11 bg-slate-900 border border-white/10 text-indigo-400 rounded-2xl hover:bg-slate-800 transition-all shadow-xl flex items-center justify-center group">
            <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-700" />
          </button>
        </div>
      </div>
      <EventSpecificContent />
    </div>
  );

  return (
    <div id="dashboard_page" className={cn("space-y-4 font-body pb-6", isSuperAdmin && "bg-slate-950 min-h-screen -m-8 p-8 overflow-x-hidden")}>
      {isSuperAdmin ? <SuperAdminLayout /> : <SubAdminLayout />}
    </div>
  );
}
