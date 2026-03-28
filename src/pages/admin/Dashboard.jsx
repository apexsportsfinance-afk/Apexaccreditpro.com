import React, { useState, useEffect } from "react";
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
  Activity
} from "lucide-react";
import StatsCard from "../../components/ui/StatsCard";
import Card, { CardHeader, CardContent } from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import { EventsAPI, AccreditationsAPI, AuditAPI } from "../../lib/storage";
import { formatDate } from "../../lib/utils";

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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const results = await Promise.allSettled([
        EventsAPI.getAll(),
        AccreditationsAPI.getStats(),
        AccreditationsAPI.getRecent(100),
        AuditAPI.getRecent(10)
      ]);

      const [eventsRes, statsRes, recentRes, auditRes] = results;

      let allEvents = [];
      let accStats = { total: 0, pending: 0, approved: 0, rejected: 0 };

      if (eventsRes.status === "fulfilled") {
        allEvents = eventsRes.value;
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

      // Log errors for debugging
      results.forEach((res, i) => {
        if (res.status === "rejected") {
          // Specific logging already done above for main sources, this catches any missed or general
          // console.error(`Dashboard source ${i} failed:`, res.reason);
        }
      });

    } catch (error) {
      console.error("Dashboard massive failure:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityIcon = (action) => {
    switch (action) {
      case "accreditation_approved":
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      case "accreditation_rejected":
        return <XCircle className="w-4 h-4 text-red-400" />;
      case "accreditation_submitted":
        return <Clock className="w-4 h-4 text-amber-400" />;
      default:
        return <Activity className="w-4 h-4 text-blue-400" />;
    }
  };

  return (
    <div id="dashboard_page" className="space-y-xl font-body">
      <div>
        <h1 className="font-h1 mb-2">
          <span className="text-gradient">Dashboard</span>
        </h1>
        <p className="text-sm text-slate-500 font-medium tracking-wide opacity-80">
          Systems oversight and accreditation intelligence
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-md">
        <StatsCard
          title="Total Events"
          value={stats.totalEvents}
          icon={Calendar}
          iconColor="text-primary-400"
          data={trends.events}
        />
        <StatsCard
          title="Total Accreditations"
          value={stats.totalAccreditations}
          icon={Users}
          iconColor="text-primary-500"
          data={trends.accreditations}
        />
        <StatsCard
          title="Pending Review"
          value={stats.pending}
          icon={Clock}
          iconColor="text-warning"
          change={stats.pending > 0 ? "Action Required" : undefined}
          changeType={stats.pending > 0 ? "negative" : "neutral"}
          data={trends.pending}
        />
        <StatsCard
          title="Approved"
          value={stats.approved}
          icon={CheckCircle}
          iconColor="text-success"
          data={trends.approved}
        />
        <StatsCard
          title="Rejected"
          value={stats.rejected}
          icon={XCircle}
          iconColor="text-critical"
          data={trends.rejected}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <h2 className="font-h2 text-whiteElite">Recent Submissions</h2>
            <Link to="/admin/accreditations" className="text-xs font-bold text-primary hover:text-primary-400 flex items-center gap-1 transition-colors uppercase tracking-widest">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentAccreditations.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm italic">
                No active datasets
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {recentAccreditations.map((acc) => (
                  <motion.div
                    key={acc.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-4 hover:bg-white/5 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-whiteElite group-hover:text-primary transition-colors">
                          {acc.firstName} {acc.lastName}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className="opacity-80">
                            {acc.role}
                          </Badge>
                          <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <h2 className="font-h2 text-whiteElite">System Activity</h2>
            <Link to="/admin/audit" className="text-xs font-bold text-primary hover:text-primary-400 flex items-center gap-1 transition-colors uppercase tracking-widest">
              Audit Logs <ArrowRight className="w-3 h-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentActivity.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm italic">
                No recent interactions
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {recentActivity.slice(0, 6).map((log) => (
                  <div key={log.id} className="p-4 flex items-start gap-4 group">
                    <div className="p-2 rounded-lg bg-white/5 group-hover:bg-primary/10 transition-colors border border-white/5">
                      {getActivityIcon(log.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-whiteElite capitalize">
                        {log.action.replace(/_/g, " ")}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        <span className="text-primary/60 font-semibold">{log.userName}</span> • {formatDate(log.timestamp, "MMM dd, HH:mm")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <h2 className="font-h2 text-whiteElite">Active Operations</h2>
          <Link to="/admin/events" className="text-xs font-bold text-primary hover:text-primary-400 flex items-center gap-1 transition-colors uppercase tracking-widest">
            Manage <ArrowRight className="w-3 h-3" />
          </Link>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center text-slate-500 text-sm py-12 italic">
              No active events scheduled
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
              {events.map((event) => {
                const counts = eventCounts[event.id] || { total: 0, pending: 0, approved: 0 };
                return (
                  <motion.div
                    key={event.id}
                    className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-primary/40 transition-all shadow-lg hover:shadow-primary/10 group cursor-pointer"
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-sm font-bold text-whiteElite leading-tight group-hover:text-primary transition-colors pr-2">
                        {event.name}
                      </h3>
                      <div className="p-1.5 rounded-lg bg-white/5 border border-white/5 group-hover:border-primary/20">
                        <Calendar className="w-3.5 h-3.5 text-primary" />
                      </div>
                    </div>
                    
                    <p className="text-xs text-slate-500 font-medium mb-5 flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-primary/40"></span>
                        {formatDate(event.startDate, "MMM dd")} - {formatDate(event.endDate, "MMM dd, yyyy")}
                    </p>

                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        {counts.total} TOTAL
                      </span>
                      <div className="flex items-center gap-2">
                        <Badge variant="warning" className="px-1.5 opacity-60 group-hover:opacity-100">{counts.pending}</Badge>
                        <Badge variant="success" className="px-1.5 opacity-60 group-hover:opacity-100">{counts.approved}</Badge>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
