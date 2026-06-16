import React, { useState, useEffect, useMemo } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Plus, Search, ShieldAlert, Filter, Building2, MapPin, Mail, Phone, Calendar, Trophy, List, Link2, Check, X, Tags, FileText } from "lucide-react";
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
import AssignSportsModal from "../../../components/teams/AssignSportsModal";
import DocumentRequirementsModal from "../../../components/teams/DocumentRequirementsModal";
import PortalScheduleTab from "../../../components/portal/tabs/PortalScheduleTab";
import { formatDate } from "../../../lib/utils";

export default function TeamsDashboard() {
  const { isSuperAdmin, isEventAdmin } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  // Security Check
  const isAdmin = isSuperAdmin || isEventAdmin;

  const [teams, setTeams] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ total: 0, active: 0, pending: 0, suspended: 0, rejected: 0 });

  // team_id -> [{ sport_name, gender }]
  const [teamSportsMap, setTeamSportsMap] = useState({});

  // Filters
  const [selectedEventId, setSelectedEventId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // View mode: "teams" list vs event-wide "schedule" & standings
  const [viewMode, setViewMode] = useState("teams");

  // Row selection for bulk sport assignment
  const [selectedTeamIds, setSelectedTeamIds] = useState([]);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [assignSportsModalOpen, setAssignSportsModalOpen] = useState(false);
  const [docRequirementsModalOpen, setDocRequirementsModalOpen] = useState(false);

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
      setStats({ total: 0, active: 0, pending: 0, suspended: 0, rejected: 0 });
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
      setSelectedTeamIds([]);

      const teamStats = await TeamAPI.getTeamStats(eventId);
      setStats(teamStats);

      const sportsRows = await TeamAPI.getTeamSportsByEvent(eventId);
      const map = {};
      (sportsRows || []).forEach(row => {
        if (!map[row.team_id]) map[row.team_id] = [];
        map[row.team_id].push({ sport_name: row.sport_name, gender: row.gender });
      });
      setTeamSportsMap(map);
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

  const handleApproveReject = async (e, team, newStatus) => {
    e.stopPropagation();
    try {
      await TeamAPI.updateTeam(team.id, { status: newStatus });
      toast.success(newStatus === "active" ? "Team approved" : "Team rejected");
      loadTeams(selectedEventId);
    } catch (err) {
      console.error("Failed to update team status", err);
      toast.error("Failed to update team status");
    }
  };

  const handleCopyRegistrationLink = () => {
    const selectedEvent = events.find(ev => ev.id === selectedEventId);
    if (!selectedEvent?.slug) {
      toast.error("This event has no slug set, so a registration link can't be generated.");
      return;
    }
    const link = `${window.location.origin}/team-register/${selectedEvent.slug}`;
    navigator.clipboard.writeText(link);
    toast.success("Registration link copied");
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

  const toggleTeamSelection = (teamId) => {
    setSelectedTeamIds(prev =>
      prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]
    );
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = filteredTeams.map(t => t.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedTeamIds.includes(id));
    setSelectedTeamIds(allSelected ? [] : visibleIds);
  };

  const handleSportsAssigned = () => {
    if (selectedEventId) loadTeams(selectedEventId);
  };


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
          
          <Button onClick={handleCopyRegistrationLink} variant="ghost" icon={Link2} disabled={!selectedEventId}>
            Copy Registration Link
          </Button>

          <Button onClick={() => setAssignSportsModalOpen(true)} variant="secondary" icon={Tags} disabled={!selectedEventId || teams.length === 0}>
            Assign Sports
          </Button>

          <Button onClick={() => setDocRequirementsModalOpen(true)} variant="secondary" icon={FileText} disabled={!selectedEventId}>
            Doc Requirements
          </Button>

          <Button onClick={() => setCreateModalOpen(true)} icon={Plus}>
            Create Team
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
        <Card className="bg-base-alt">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted">Rejected</p>
              <p className="text-2xl font-bold text-main mt-1">{stats.rejected}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-500/10 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-slate-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 items-center justify-between bg-base-alt/50 rounded-t-2xl">
          {viewMode === "teams" ? (
            <>
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
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </>
          ) : (
            <div className="flex-1">
              <p className="text-sm text-main font-medium">Event-wide schedule & standings</p>
              <p className="text-xs text-muted mt-0.5">Browse fixtures and league tables for every team without opening a profile.</p>
            </div>
          )}

          <div className="flex items-center gap-1 bg-base border border-border rounded-lg p-1 w-full sm:w-auto shrink-0">
            <button
              onClick={() => setViewMode("teams")}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${viewMode === "teams" ? "bg-primary-500 text-white" : "text-muted hover:text-main"}`}
            >
              <List className="w-3.5 h-3.5" /> Teams
            </button>
            <button
              onClick={() => setViewMode("schedule")}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${viewMode === "schedule" ? "bg-primary-500 text-white" : "text-muted hover:text-main"}`}
            >
              <Trophy className="w-3.5 h-3.5" /> Schedule & Standings
            </button>
          </div>
        </div>

        {/* Data Grid */}
        {viewMode === "schedule" ? (
          <div className="p-4">
            {selectedEventId ? (
              <PortalScheduleTab eventId={selectedEventId} />
            ) : (
              <EmptyState
                icon={Calendar}
                title="No Event Selected"
                description="Select an event above to view its schedule and standings."
              />
            )}
          </div>
        ) : (
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
                  <th className="px-4 py-4 font-medium text-muted w-10">
                    <input
                      type="checkbox"
                      checked={filteredTeams.length > 0 && filteredTeams.every(t => selectedTeamIds.includes(t.id))}
                      onChange={toggleSelectAllVisible}
                      className="w-4 h-4 accent-primary-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-6 py-4 font-medium text-muted">Team Name</th>
                  <th className="px-6 py-4 font-medium text-muted">Location</th>
                  <th className="px-6 py-4 font-medium text-muted">Contact</th>
                  <th className="px-6 py-4 font-medium text-muted">Sports</th>
                  <th className="px-6 py-4 font-medium text-muted">Status</th>
                  <th className="px-6 py-4 font-medium text-muted text-right">Added</th>
                  <th className="px-6 py-4 font-medium text-muted text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTeams.map((team) => (
                  <tr
                    key={team.id}
                    onClick={() => navigate(`/admin/teams/${team.id}`)}
                    className="hover:bg-base-alt/50 transition-colors group cursor-pointer"
                  >
                    <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedTeamIds.includes(team.id)}
                        onChange={() => toggleTeamSelection(team.id)}
                        className="w-4 h-4 accent-primary-500 cursor-pointer"
                      />
                    </td>
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
                      {teamSportsMap[team.id]?.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 max-w-[220px]">
                          {teamSportsMap[team.id].map((s, i) => (
                            <Badge key={i} variant="muted">
                              {s.sport_name}{s.gender ? ` (${s.gender})` : ""}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted italic text-xs">No sports assigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={
                          team.status === 'active' ? 'success' :
                          team.status === 'suspended' ? 'danger' :
                          team.status === 'rejected' ? 'danger' :
                          team.status === 'completed' ? 'muted' : 'warning'
                        }
                      >
                        {(team.status || 'pending').charAt(0).toUpperCase() + (team.status || 'pending').slice(1)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right text-muted">
                      {formatDate(team.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {team.status === 'pending' && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => handleApproveReject(e, team, 'active')}
                            title="Approve"
                            className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleApproveReject(e, team, 'rejected')}
                            title="Reject"
                            className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        )}
      </Card>

      <CreateTeamModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onSubmit={handleCreateTeam}
        events={events}
        defaultEventId={selectedEventId}
      />

      <AssignSportsModal
        isOpen={assignSportsModalOpen}
        onClose={() => setAssignSportsModalOpen(false)}
        eventId={selectedEventId}
        teams={teams}
        selectedTeamIds={selectedTeamIds}
        onAssigned={handleSportsAssigned}
      />

      <DocumentRequirementsModal
        isOpen={docRequirementsModalOpen}
        onClose={() => setDocRequirementsModalOpen(false)}
        eventId={selectedEventId}
        eventName={events.find(ev => ev.id === selectedEventId)?.name}
      />
    </div>
  );
}
