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
import { formatDate, getStatusColor, getRoleColor } from "../../lib/utils";

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
  const [allAccreditations, setAllAccreditations] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const allEvents = await EventsAPI.getAll();
    const allAccreditations = await AccreditationsAPI.getAll();
    const activityLogs = await AuditAPI.getRecent(10);

    setEvents(allEvents);
    setAllAccreditations(allAccreditations);
    setStats({
      totalEvents: allEvents.length,
      totalAccreditations: allAccreditations.length,
      pending: allAccreditations.filter((a) => a.status === "pending").length,
      approved: allAccreditations.filter((a) => a.status === "approved").length,
      rejected: allAccreditations.filter((a) => a.status === "rejected").length
    });
    setRecentAccreditations(
      allAccreditations
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5)
    );
    setRecentActivity(activityLogs);
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
    <div id="dashboard_page" className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
        <p className="text-lg text-slate-400 font-extralight">
          Overview of your accreditation management system
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatsCard
          title="Total Events"
          value={stats.totalEvents}
          icon={Calendar}
          iconColor="text-blue-400"
        />
        <StatsCard
          title="Total Accreditations"
          value={stats.totalAccreditations}
          icon={Users}
          iconColor="text-purple-400"
        />
        <StatsCard
          title="Pending Review"
          value={stats.pending}
          icon={Clock}
          iconColor="text-amber-400"
          change={stats.pending > 0 ? "Requires attention" : undefined}
          changeType={stats.pending > 0 ? "negative" : "neutral"}
        />
        <StatsCard
          title="Approved"
          value={stats.approved}
          icon={CheckCircle}
          iconColor="text-emerald-400"
        />
        <StatsCard
          title="Rejected"
          value={stats.rejected}
          icon={XCircle}
          iconColor="text-red-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Recent Submissions</h2>
            <Link to="/admin/accreditations" className="text-lg text-primary-400 hover:text-primary-300 flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentAccreditations.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-lg">
                No accreditations yet
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {recentAccreditations.map((acc) => (
                  <motion.div
                    key={acc.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-4 hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-lg font-medium text-white">
                          {acc.firstName} {acc.lastName}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={getRoleColor(acc.role)}>
                            {acc.role}
                          </Badge>
                          <span className="text-lg text-slate-500">
                            {acc.club}
                          </span>
                        </div>
                      </div>
                      <Badge className={getStatusColor(acc.status)}>
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
            <h2 className="text-xl font-semibold text-white">Recent Activity</h2>
            <Link to="/admin/audit" className="text-lg text-primary-400 hover:text-primary-300 flex items-center gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentActivity.length === 0 ? (
              <div className="p-6 text-center text-slate-500 text-lg">
                No activity yet
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {recentActivity.slice(0, 6).map((log) => (
                  <div key={log.id} className="p-4 flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-slate-800">
                      {getActivityIcon(log.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-lg text-white">
                        {log.action.replace(/_/g, " ")}
                      </p>
                      <p className="text-lg text-slate-500 truncate">
                        by {log.userName} • {formatDate(log.timestamp, "MMM dd, HH:mm")}
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
          <h2 className="text-xl font-semibold text-white">Active Events</h2>
          <Link to="/admin/events" className="text-lg text-primary-400 hover:text-primary-300 flex items-center gap-1">
            Manage Events <ArrowRight className="w-4 h-4" />
          </Link>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center text-slate-500 text-lg py-8">
              No events created yet
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {events.map((event) => {
                const eventAccreditations = allAccreditations.filter((a) => a.eventId === event.id);
                const pending = eventAccreditations.filter((a) => a.status === "pending").length;
                const approved = eventAccreditations.filter((a) => a.status === "approved").length;
                return (
                  <Link
                    key={event.id}
                    to={`/admin/accreditations?event=${event.id}`}
                    className="block"
                  >
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      className="bg-gradient-to-br from-swim-deep/60 via-primary-950/50 to-ocean-950/40 border border-primary-500/30 rounded-xl p-4 hover:border-primary-400/60 transition-all shadow-lg shadow-primary-900/20 hover:shadow-primary-500/20"
                    >
                      <h3 className="text-lg font-semibold text-white mb-2 truncate">
                        {event.name}
                      </h3>
                      <p className="text-lg text-slate-400 mb-3">
                        {formatDate(event.startDate)} - {formatDate(event.endDate)}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-lg text-slate-500">
                          {eventAccreditations.length} registrations
                        </span>
                        {pending > 0 && (
                          <Badge variant="warning">{pending} pending</Badge>
                        )}
                      </div>
                    </motion.div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}