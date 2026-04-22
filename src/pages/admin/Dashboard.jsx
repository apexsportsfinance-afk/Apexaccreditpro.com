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
  MapPin
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
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
  const { user, canAccessEvent, isSuperAdmin } = useAuth();

  useEffect(() => {
    let interval;
    if (!isSuperAdmin && user?.allowedEventIds?.length > 0) {
      const fetchLiveStats = async () => {
        try {
          // Fetch up to 1000 recent scans for richer graphing
          const promises = user.allowedEventIds.map(id => AttendanceAPI.getScanLogsByEvent(id, 1000));
          const res = await Promise.all(promises);
          
          // Sort chronologically for time series
          const sorted = res.flat().sort((a, b) => {
            const timeA = a.scanned_at || a.timestamp || a.created_at;
            const timeB = b.scanned_at || b.timestamp || b.created_at;
            return new Date(timeA) - new Date(timeB);
          });
          setLiveScanLogs(sorted);
        } catch (e) {
          console.error("Failed to fetch live scan stats:", e);
        }
      };
      
      fetchLiveStats();
      interval = setInterval(fetchLiveStats, 4000); // 4 seconds live update
    }
    return () => clearInterval(interval);
  }, [isSuperAdmin, user?.allowedEventIds]);

  const liveAreaSummary = useMemo(() => {
    const summary = {};
    // Pre-fill all zones with 0 to ensure they always show up
    allZones.forEach(z => {
      if (z.name) summary[z.name] = 0;
    });

    liveScanLogs.forEach(log => {
      const label = log.device_label || 'Other';
      
      // Attempt case-insensitive match for pre-filled zones
      let matchedLabel = label;
      const existingKey = Object.keys(summary).find(k => k.toLowerCase() === label.toLowerCase());
      if (existingKey) {
        matchedLabel = existingKey;
      }
      
      summary[matchedLabel] = (summary[matchedLabel] || 0) + 1;
    });
    return summary;
  }, [liveScanLogs, allZones]);

  useEffect(() => {
    // Only load data if we know the user's status (Super Admin or we have their event IDs)
    // If allowedEventIds is undefined, it means AuthContext is still enhancing the profile
    if (isSuperAdmin || user?.allowedEventIds !== undefined) {
      loadData();
    }
  }, [user?.allowedEventIds, isSuperAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      const allowedEventIds = user?.allowedEventIds || [];
      const results = await Promise.allSettled([
        EventsAPI.getAll(),
        AccreditationsAPI.getStats(isSuperAdmin ? null : allowedEventIds),
        AccreditationsAPI.getRecent(100, isSuperAdmin ? null : allowedEventIds),
        AuditAPI.getRecent(10),
        isSuperAdmin 
          ? ZonesAPI.getAll() 
          : Promise.all(allowedEventIds.map(id => ZonesAPI.getByEventId(id))).then(res => res.flat())
      ]);

      const [eventsRes, statsRes, recentRes, auditRes, zonesRes] = results;

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
        // deduplicate zones by name
        const uniqueZones = [];
        const seen = new Set();
        zonesRes.value.forEach(z => {
          if (z.name && !seen.has(z.name.toLowerCase())) {
            seen.add(z.name.toLowerCase());
            uniqueZones.push(z);
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
        return <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case "accreditation_rejected":
        return <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />;
      case "accreditation_submitted":
        return <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      default:
        return <Activity className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div id="dashboard_page" className="space-y-xl font-body">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-main mb-2 uppercase tracking-tighter italic">
            Dashboard
          </h1>
          <p className="text-sm text-muted font-medium tracking-wide uppercase opacity-80">
            Systems oversight and accreditation intelligence
          </p>
        </div>
        <button 
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-base-alt hover:bg-border border border-border rounded-xl text-main text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50 shadow-sm"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          {loading ? "Refreshing..." : "Refresh Data"}
        </button>
      </div>

      <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-md", isSuperAdmin ? "lg:grid-cols-5" : "lg:grid-cols-3")}>
        {isSuperAdmin && (
          <StatsCard
            title="Total Events"
            value={stats.totalEvents}
            icon={Calendar}
            iconColor="text-primary-400"
            data={trends.events}
          />
        )}
        <StatsCard
          title="Total Accreditations"
          value={stats.totalAccreditations}
          icon={Users}
          iconColor="text-primary-500"
          data={isSuperAdmin ? trends.accreditations : []}
        />
        <StatsCard
          title="Pending Review"
          value={stats.pending}
          icon={Clock}
          iconColor="text-warning"
          change={stats.pending > 0 ? "Action Required" : undefined}
          changeType={stats.pending > 0 ? "negative" : "neutral"}
          data={isSuperAdmin ? trends.pending : []}
        />
        {isSuperAdmin && (
          <StatsCard
            title="Approved"
            value={stats.approved}
            icon={CheckCircle}
            iconColor="text-success"
            data={trends.approved}
          />
        )}
        <StatsCard
          title="Rejected"
          value={stats.rejected}
          icon={XCircle}
          iconColor="text-critical"
          data={isSuperAdmin ? trends.rejected : []}
        />
      </div>

      {isSuperAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
          <Card className="bg-base border-border">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/50">
              <h2 className="text-xl font-bold text-main">Recent Submissions</h2>
              <Link to="/admin/accreditations" className="text-xs font-bold text-primary hover:text-primary-400 flex items-center gap-1 transition-colors uppercase tracking-widest">
                View All <ArrowRight className="w-3 h-3" />
              </Link>
            </CardHeader>
          <CardContent className="p-0">
            {recentAccreditations.length === 0 ? (
              <div className="p-8 text-center text-muted text-sm italic">
                No active datasets
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {recentAccreditations.map((acc) => (
                  <motion.div
                    key={acc.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-4 hover:bg-white/5 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-main group-hover:text-primary-600 dark:group-hover:text-primary transition-colors">
                          {acc.firstName} {acc.lastName}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className="bg-primary/20 text-primary-300 dark:text-primary-200 border-primary/30 font-black">
                            {acc.role}
                          </Badge>
                          <span className="text-[11px] text-slate-300 dark:text-slate-400 font-bold uppercase tracking-wider">
                            {acc.club}
                          </span>
                        </div>
                      </div>
                      <Badge variant={acc.status === "approved" ? "success" : acc.status === "rejected" ? "danger" : "warning"}>
                        {acc.status}
                      </Badge>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-base border-border">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50">
            <h2 className="text-xl font-bold text-main">System Activity</h2>
            <Link to="/admin/audit" className="text-xs font-bold text-primary hover:text-primary-400 flex items-center gap-1 transition-colors uppercase tracking-widest">
              Audit Logs <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentActivity.length === 0 ? (
              <div className="p-8 text-center text-muted text-sm italic">
                No recent interactions
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {recentActivity.slice(0, 6).map((log) => (
                  <div key={log.id} className="p-4 flex items-start gap-4 group">
                    <div className="p-2 rounded-lg bg-base-alt group-hover:bg-primary-500/10 transition-colors border border-border">
                      {getActivityIcon(log.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-main capitalize">
                        {log.action.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        <span className="text-primary-600 dark:text-primary/60 font-semibold">{log.userName}</span> • {formatDate(log.timestamp, "MMM dd, HH:mm")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      {!isSuperAdmin && (
        <div className="space-y-4 mt-4">
          <div className="flex items-center justify-between ml-1 mb-1">
            <div>
              <h2 className="text-2xl font-black uppercase text-main tracking-tight flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-500 animate-pulse" /> Live Event Telemetry
              </h2>
            </div>
            <Badge variant="success" className="animate-pulse bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-1.5 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
              LIVE SYSTEM ACTIVE
            </Badge>
          </div>

          {/* Main Layout for TV Display */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left Column: Total KPI & Velocity Graph */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              
              <div className="bg-gradient-to-r from-emerald-900/40 to-[#1e293b] border border-emerald-700/30 p-5 rounded-xl shadow-xl flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-500/70 mb-1">Total Live Telemetry Scans</p>
                  <p className="text-5xl font-black text-white tracking-tighter">{liveScanLogs.length}</p>
                </div>
                <div className="bg-emerald-500/10 p-4 rounded-full">
                  <Activity className="w-10 h-10 text-emerald-400" />
                </div>
              </div>

              {/* Real-time Time Series Graph */}
              <Card className="bg-base-alt/50 border-border/60 shadow-xl flex-1">
                <CardHeader className="border-b border-border/50 pb-3">
                  <h3 className="text-xs font-black text-main uppercase tracking-widest">Scan Velocity (Recent Activity)</h3>
                </CardHeader>
                <CardContent className="p-4 h-[240px]">
                  {liveScanLogs.length > 0 ? (() => {
                    const intervals = {};
                    liveScanLogs.forEach(log => {
                      const timeStr = log.scanned_at || log.timestamp || log.created_at;
                      if (!timeStr) return;
                      const time = new Date(timeStr).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                      if (time !== 'Invalid Date') {
                        intervals[time] = (intervals[time] || 0) + 1;
                      }
                    });
                    const chartData = Object.keys(intervals).map(time => ({ time, scans: intervals[time] }));

                    return (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorScans" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="time" stroke="#64748b" tick={{ fill: '#cbd5e1' }} fontSize={10} tickMargin={10} minTickGap={30} />
                          <YAxis stroke="#64748b" tick={{ fill: '#cbd5e1' }} fontSize={10} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                            itemStyle={{ color: '#10b981', fontWeight: 'bold' }}
                          />
                          <Area type="monotone" dataKey="scans" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorScans)" isAnimationActive={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    );
                  })() : (
                    <div className="h-full flex items-center justify-center text-muted italic text-xs">Waiting for incoming scan data...</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column: All Zones Grid */}
            <Card className="bg-base-alt/50 border-border/60 shadow-xl lg:col-span-1 flex flex-col items-stretch">
              <CardHeader className="border-b border-border/50 pb-3">
                <h3 className="text-xs font-black text-main uppercase tracking-widest">Active Zones & Scans</h3>
              </CardHeader>
              <CardContent className="p-3 flex-1">
                 {Object.keys(liveAreaSummary).length > 0 ? (
                   <div className="grid grid-cols-2 gap-2">
                     {Object.entries(liveAreaSummary)
                       .sort((a,b) => b[1] - a[1])
                       .map(([area, count]) => (
                       <div key={area} className="break-inside-avoid bg-[#1e293b] border border-gray-700/50 p-2.5 rounded-lg flex items-center justify-between group shadow-sm">
                         <div className="flex items-center gap-1.5 overflow-hidden w-full">
                           <MapPin className="w-3 h-3 text-sky-400 opacity-70 flex-shrink-0" />
                           <span className="text-[10px] font-black uppercase tracking-widest text-gray-300 truncate" title={area}>{area}</span>
                         </div>
                         <p className="text-sm font-black text-white ml-2 flex-shrink-0">{count}</p>
                       </div>
                     ))}
                   </div>
                 ) : (
                   <div className="h-full flex items-center justify-center text-muted italic text-xs">No zone data available</div>
                 )}
              </CardContent>
            </Card>
          </div>

        </div>
      )}

      {isSuperAdmin && (
      <Card className="bg-base border-border">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border/50">
          <h2 className="text-xl font-bold text-main">Active Operations</h2>
          <Link to="/admin/events" className="text-xs font-bold text-primary hover:text-primary-400 flex items-center gap-1 transition-colors uppercase tracking-widest">
            Manage <ArrowRight className="w-3 h-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center text-muted text-sm py-12 italic">
              No active events scheduled
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
              {events.map((event) => {
                const counts = eventCounts[event.id] || { total: 0, pending: 0, approved: 0 };
                return (
                  <motion.div
                    key={event.id}
                    className="bg-base-alt border border-border rounded-xl p-5 hover:border-primary-500/40 transition-all shadow-lg hover:shadow-primary/10 group cursor-pointer"
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-sm font-bold text-main leading-tight group-hover:text-primary-600 dark:group-hover:text-primary transition-colors pr-2">
                        {event.name}
                      </h3>
                      <div className="p-1.5 rounded-lg bg-white/5 border border-white/5 group-hover:border-primary/20">
                        <Calendar className="w-3.5 h-3.5 text-primary" />
                      </div>
                    </div>
                    
                    <p className="text-xs text-slate-400 font-bold mb-5 flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-primary-500/60"></span>
                        {formatDate(event.startDate, "MMM dd")} - {formatDate(event.endDate, "MMM dd, yyyy")}
                    </p>

                    <div className="flex items-center justify-between pt-4 border-t border-border/50">
                      <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">
                        {counts.total} TOTAL
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="warning" className="px-2 shadow-lg">{counts.pending}</Badge>
                        <Badge variant="success" className="px-2 shadow-lg">{counts.approved}</Badge>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}
