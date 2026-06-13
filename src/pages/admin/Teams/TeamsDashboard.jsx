import React, { useState, useEffect, useMemo } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Plus, Search, ShieldAlert, Filter, Building2, MapPin, Mail, Phone, Calendar } from "lucide-react";
import Card, { CardContent } from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Badge from "../../../components/ui/Badge";
import EmptyState from "../../../components/ui/EmptyState";
import { useToast } from "../../../components/ui/Toast";
import { useAuth } from "../../../contexts/AuthContext";
import { TeamAPI } from "../../../services/teamApi";
import { EventsAPI } from "../../../lib/storage";
import CreateTeamModal from "../../../components/teams/CreateTeamModal";
import { formatDate } from "../../../lib/utils";

export default function TeamsDashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  
  // Security Check
  const isAdmin = user?.role === 'super_admin' || user?.role === 'event_admin';

  const [teams, setTeams] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ total: 0, active: 0, pending: 0, suspended: 0 });

  // Filters
  const [selectedEventId, setSelectedEventId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      loadEvents();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && selectedEventId) {
      loadTeams(selectedEventId);
    } else if (isAdmin && !selectedEventId) {
      setTeams([]);
      setStats({ total: 0, active: 0, pending: 0, suspended: 0 });
      setLoading(false);
    }
  }, [isAdmin, selectedEventId]);

  const loadEvents = async () => {
    try {
      const eventData = await EventsAPI.getAllMinimal();
      // If event_admin, ideally filter by what they can access.
      // For now, load all and let RLS block if needed.
      setEvents(eventData);
      if (eventData.length > 0) {
        setSelectedEventId(eventData[0].id);
      }
    } catch (err) {
      console.error("Failed to load events", err);
      toast.error("Failed to load events");
    }
  };

  const loadTeams = async (eventId) => {
    try {
      setLoading(true);
      setError(null);
      const data = await TeamAPI.getTeamsByEvent(eventId);
      setTeams(data);
      
      const teamStats = await TeamAPI.getTeamStats(eventId);
      setStats(teamStats);
    } catch (err) {
      console.error("Failed to load teams", err);
      setError(err.message || "Failed to load teams");
      toast.error("Failed to load teams");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async (teamData) => {
    try {
      const newTeam = await TeamAPI.createTeam(teamData);
      toast.success("Team created successfully");
      if (teamData.event_id === selectedEventId) {
        loadTeams(selectedEventId);
      }
    } catch (err) {
      console.error("Create team error", err);
      toast.error("Failed to create team: " + (err.message || "Unknown error"));
      throw err;
    }
  };

  // Derived state for filtering
  const filteredTeams = useMemo(() => {
    return teams.filter(team => {
      const matchesSearch = (team.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             team.short_name?.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus = statusFilter === "all" || team.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [teams, searchQuery, statusFilter]);


  if (!isAdmin) {
    return (
      <div className="p-8 max-w-2xl mx-auto mt-12 text-center">
        <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-main mb-2">Access Denied</h1>
        <p className="text-muted">You do not have permission to view the Teams Portal.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-main tracking-tight">Apex Team Portal</h1>
          <p className="text-muted mt-1">Long-Term League Management</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-base-alt border border-border rounded-xl px-3 py-1.5 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted" />
            <select 
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className="bg-transparent text-sm font-medium text-main outline-none min-w-[200px]"
            >
              <option value="" disabled>Select Event...</option>
              {events.map(ev => (
                <option key={ev.id} value={ev.id}>{ev.name}</option>
              ))}
            </select>
          </div>
          
          <Button onClick={() => setCreateModalOpen(true)} icon={Plus}>
            Create Team
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-base-alt">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted">Total Teams</p>
              <p className="text-2xl font-bold text-main mt-1">{stats.total}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary-500/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-base-alt">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted">Active Teams</p>
              <p className="text-2xl font-bold text-main mt-1">{stats.active}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-base-alt">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted">Pending Teams</p>
              <p className="text-2xl font-bold text-main mt-1">{stats.pending}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-base-alt">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted">Suspended</p>
              <p className="text-2xl font-bold text-main mt-1">{stats.suspended}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 items-center justify-between bg-base-alt/50 rounded-t-2xl">
          <div className="w-full sm:max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input
              type="text"
              placeholder="Search teams by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-base border border-border rounded-lg text-sm text-main focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Filter className="w-4 h-4 text-muted hidden sm:block" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-base border border-border rounded-lg px-3 py-2 text-sm font-medium text-main outline-none w-full sm:w-auto"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Data Grid */}
        <div className="overflow-x-auto">
          {error ? (
            <div className="p-12 text-center">
              <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <p className="text-main font-medium">Error loading teams</p>
              <p className="text-muted text-sm">{error}</p>
            </div>
          ) : loading ? (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-muted">Loading teams...</p>
            </div>
          ) : filteredTeams.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No Teams Found"
              description={searchQuery ? "No teams match your search criteria." : "There are no teams in this event yet."}
              action={
                !searchQuery && (
                  <Button onClick={() => setCreateModalOpen(true)} icon={Plus}>
                    Create First Team
                  </Button>
                )
              }
            />
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead>
                <tr className="bg-base-alt/30 border-b border-border">
                  <th className="px-6 py-4 font-medium text-muted">Team Name</th>
                  <th className="px-6 py-4 font-medium text-muted">Location</th>
                  <th className="px-6 py-4 font-medium text-muted">Contact</th>
                  <th className="px-6 py-4 font-medium text-muted">Status</th>
                  <th className="px-6 py-4 font-medium text-muted text-right">Added</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTeams.map((team) => (
                  <tr 
                    key={team.id} 
                    onClick={() => navigate(`/admin/teams/${team.id}`)}
                    className="hover:bg-base-alt/50 transition-colors group cursor-pointer"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {team.logo_url ? (
                          <img src={team.logo_url} alt={team.name} className="w-10 h-10 rounded-full object-cover border border-border" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary-500/10 flex items-center justify-center border border-primary-500/20">
                            <Building2 className="w-5 h-5 text-primary-500" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-main group-hover:text-primary-500 transition-colors">
                            {team.name}
                          </p>
                          {team.short_name && (
                            <p className="text-xs text-muted mt-0.5">{team.short_name}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-muted">
                        <MapPin className="w-4 h-4 shrink-0" />
                        <span className="truncate max-w-[150px]">
                          {team.city ? `${team.city}, ` : ''}{team.country || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {team.contact_name ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-main font-medium">{team.contact_name}</span>
                          {team.contact_email && (
                            <span className="text-xs text-muted flex items-center gap-1">
                              <Mail className="w-3 h-3" /> {team.contact_email}
                            </span>
                          )}
                          {team.contact_phone && (
                            <span className="text-xs text-muted flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {team.contact_phone}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted italic">No contact set</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={
                          team.status === 'active' ? 'success' :
                          team.status === 'suspended' ? 'error' :
                          team.status === 'completed' ? 'neutral' : 'warning'
                        }
                      >
                        {team.status.charAt(0).toUpperCase() + team.status.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right text-muted">
                      {formatDate(team.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      <CreateTeamModal 
        isOpen={createModalOpen} 
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleCreateTeam}
        events={events}
        defaultEventId={selectedEventId}
      />
    </div>
  );
}
