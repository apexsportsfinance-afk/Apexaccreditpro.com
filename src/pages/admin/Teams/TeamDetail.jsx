import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Building2, Users, Trophy, ShieldAlert, LayoutDashboard, FileText, MapPin, BookOpen, Calendar, Pencil } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { TeamAPI } from "../../../services/teamApi";
import { useToast } from "../../../components/ui/Toast";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import EditTeamModal from "../../../components/teams/EditTeamModal";

// Tabs
import TeamOverviewTab from "../../../components/teams/tabs/TeamOverviewTab";
import TeamUsersTab from "../../../components/teams/tabs/TeamUsersTab";
import TeamSportsTab from "../../../components/teams/tabs/TeamSportsTab";
import TeamDocumentsTab from "../../../components/teams/tabs/TeamDocumentsTab";
import TeamRosterReviewTab from "../../../components/teams/tabs/TeamRosterReviewTab";
import TeamFacilityTab from "../../../components/teams/tabs/TeamFacilityTab";
import TeamRulesTab from "../../../components/teams/tabs/TeamRulesTab";
import PortalScheduleTab from "../../../components/portal/tabs/PortalScheduleTab";
import StorageImage from "../../../components/ui/StorageImage";

const STATUS_OPTIONS = ["pending", "active", "suspended", "completed", "rejected"];

const STATUS_SELECT_CLASSES = {
  active: "bg-emerald-600 border-emerald-400/30 text-white",
  suspended: "bg-rose-600 border-rose-400/30 text-white",
  completed: "bg-slate-500/10 border-slate-500/20 text-slate-400",
  pending: "bg-amber-600 border-amber-400/30 text-white",
  rejected: "bg-rose-700 border-rose-400/30 text-white"
};

export default function TeamDetail() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { isSuperAdmin, isEventAdmin } = useAuth();
  const toast = useToast();

  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Permission Check based on Correction 1
  const isAdmin = isSuperAdmin || isEventAdmin;

  useEffect(() => {
    if (isAdmin && teamId) {
      loadTeamDetails();
    } else if (!isAdmin) {
      setLoading(false);
    }
  }, [teamId, isAdmin]);

  const handleStatusChange = async (e) => {
    const newStatus = e.target.value;
    if (newStatus === team.status) return;
    setUpdatingStatus(true);
    try {
      const updated = await TeamAPI.updateTeam(team.id, { status: newStatus });
      setTeam(updated);
      toast.success(`Team status changed to ${newStatus}`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update team status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleEditTeam = async (formData) => {
    try {
      const updated = await TeamAPI.updateTeam(team.id, formData);
      setTeam(updated);
      toast.success("Team details updated");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update team details");
      throw err;
    }
  };

  const loadTeamDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await TeamAPI.getTeamById(teamId);
      setTeam(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load team details");
      toast.error("Failed to load team details");
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-2xl mx-auto mt-12 text-center">
        <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-main mb-2">Access Denied</h1>
        <p className="text-muted">You do not have permission to view this Team Detail page.</p>
        <Button onClick={() => navigate('/')} className="mt-6">Return Home</Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="w-8 h-8 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-muted">Loading team profile...</p>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="p-12 text-center">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h1 className="text-xl font-bold text-main mb-2">Team Not Found</h1>
        <p className="text-muted mb-6">{error || "The team you are looking for does not exist."}</p>
        <Button onClick={() => navigate('/admin/teams')} icon={ChevronLeft}>
          Back to Teams
        </Button>
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "roster", label: "Roster Review", icon: Users },
    { id: "users", label: "Users & Roles", icon: Users },
    { id: "sports", label: "Registered Sports", icon: Trophy },
    { id: "schedule", label: "Schedule & Standings", icon: Calendar },
    { id: "facility", label: "Facility Hosting", icon: MapPin },
    { id: "rules", label: "Rules & Regulations", icon: BookOpen },
    { id: "documents", label: "Documents", icon: FileText }
  ];

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Top Navigation */}
      <button 
        onClick={() => navigate('/admin/teams')}
        className="flex items-center gap-2 text-muted hover:text-main transition-colors text-sm font-medium"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Teams Dashboard
      </button>

      {/* Header Profile Section */}
      <div className="bg-base-alt border border-border rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center gap-6 shadow-sm">
        {team.logo_url ? (
          <StorageImage src={team.logo_url} alt={team.name} className="w-24 h-24 rounded-full object-cover border-4 border-base" />
        ) : (
          <div className="w-24 h-24 rounded-full bg-primary-500/10 flex items-center justify-center border-4 border-base shrink-0">
            <Building2 className="w-10 h-10 text-primary-500" />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-main truncate">{team.name}</h1>
            {isAdmin ? (
              <select
                value={team.status || 'pending'}
                onChange={handleStatusChange}
                disabled={updatingStatus}
                className={`text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full border cursor-pointer outline-none transition-all ${STATUS_SELECT_CLASSES[team.status] || STATUS_SELECT_CLASSES.pending}`}
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{s.toUpperCase()}</option>
                ))}
              </select>
            ) : (
              <Badge variant={
                team.status === 'active' ? 'success' :
                team.status === 'suspended' ? 'danger' :
                team.status === 'rejected' ? 'danger' :
                team.status === 'completed' ? 'muted' : 'warning'
              }>
                {(team.status || 'pending').toUpperCase()}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted">
            {team.short_name && <span className="font-medium">{team.short_name}</span>}
            {(team.city || team.country) && (
              <span className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-border" />
                {team.city ? `${team.city}, ` : ''}{team.country}
              </span>
            )}
          </div>
        </div>

        {isAdmin && (
          <Button variant="ghost" icon={Pencil} onClick={() => setEditModalOpen(true)}>
            Edit Team
          </Button>
        )}
      </div>

      <EditTeamModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        onSubmit={handleEditTeam}
        team={team}
      />

      {/* Tabs Menu */}
      <div className="flex items-center gap-2 border-b border-border overflow-x-auto pb-px">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id 
                ? "border-primary-500 text-primary-500" 
                : "border-transparent text-muted hover:text-main hover:border-border"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="pt-2">
        {activeTab === "overview" && (
          <TeamOverviewTab team={team} isAdmin={isAdmin} onTeamUpdate={setTeam} />
        )}
        {activeTab === "roster" && (
          <TeamRosterReviewTab teamId={team.id} />
        )}
        {activeTab === "users" && (
          <TeamUsersTab teamId={team.id} isAdmin={isAdmin} />
        )}
        {activeTab === "sports" && (
          <TeamSportsTab teamId={team.id} eventId={team.event_id} />
        )}
        {activeTab === "schedule" && (
          <PortalScheduleTab teamId={team.id} eventId={team.event_id} />
        )}
        {activeTab === "facility" && (
          <TeamFacilityTab teamId={team.id} />
        )}
        {activeTab === "rules" && (
          <TeamRulesTab teamId={team.id} eventId={team.event_id} />
        )}
        {activeTab === "documents" && (
          <TeamDocumentsTab teamId={team.id} eventId={team.event_id} />
        )}
      </div>
    </div>
  );
}
