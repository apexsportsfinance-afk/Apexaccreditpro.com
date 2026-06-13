import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeft, Building2, Users, Trophy, ShieldAlert, LayoutDashboard, FileText, MapPin, BookOpen } from "lucide-react";
import { useAuth } from "../../../contexts/AuthContext";
import { TeamAPI } from "../../../services/teamApi";
import { useToast } from "../../../components/ui/Toast";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";

// Tabs
import TeamOverviewTab from "../../../components/teams/tabs/TeamOverviewTab";
import TeamUsersTab from "../../../components/teams/tabs/TeamUsersTab";
import TeamSportsTab from "../../../components/teams/tabs/TeamSportsTab";
import TeamDocumentsTab from "../../../components/teams/tabs/TeamDocumentsTab";
import TeamRosterReviewTab from "../../../components/teams/tabs/TeamRosterReviewTab";
import TeamFacilityTab from "../../../components/teams/tabs/TeamFacilityTab";
import TeamRulesTab from "../../../components/teams/tabs/TeamRulesTab";

export default function TeamDetail() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [team, setTeam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  // Permission Check based on Correction 1
  const isAdmin = user?.role === 'super_admin' || user?.role === 'event_admin';

  useEffect(() => {
    if (isAdmin && teamId) {
      loadTeamDetails();
    } else if (!isAdmin) {
      setLoading(false);
    }
  }, [teamId, isAdmin]);

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
          <img src={team.logo_url} alt={team.name} className="w-24 h-24 rounded-full object-cover border-4 border-base" />
        ) : (
          <div className="w-24 h-24 rounded-full bg-primary-500/10 flex items-center justify-center border-4 border-base shrink-0">
            <Building2 className="w-10 h-10 text-primary-500" />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-main truncate">{team.name}</h1>
            <Badge variant={
              team.status === 'active' ? 'success' :
              team.status === 'suspended' ? 'error' :
              team.status === 'completed' ? 'neutral' : 'warning'
            }>
              {team.status.toUpperCase()}
            </Badge>
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
      </div>

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
