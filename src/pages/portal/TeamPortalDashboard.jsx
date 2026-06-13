import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Building2, LayoutDashboard, Trophy, FileText, ShieldAlert, MapPin, BookOpen } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { TeamPortalAPI } from '../../services/teamPortalApi';
import Button from '../../components/ui/Button';

// Portal Tabs
import PortalOverviewTab from '../../components/portal/tabs/PortalOverviewTab';
import PortalSportsTab from '../../components/portal/tabs/PortalSportsTab';
import PortalDocumentsTab from '../../components/portal/tabs/PortalDocumentsTab';
import PortalRosterTab from '../../components/portal/tabs/PortalRosterTab';
import PortalFacilityTab from '../../components/portal/tabs/PortalFacilityTab';
import PortalRulesTab from '../../components/portal/tabs/PortalRulesTab';
import { Users } from 'lucide-react';

export default function TeamPortalDashboard() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [team, setTeam] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (user?.id && teamId) {
      loadTeamAccess();
    }
  }, [user, teamId]);

  const loadTeamAccess = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Verify access and get role
      const role = await TeamPortalAPI.verifyTeamAccess(teamId, user.id);
      setUserRole(role);

      // 2. Fetch team details
      const teamData = await TeamPortalAPI.getPortalTeamDetails(teamId);
      setTeam(teamData);

    } catch (err) {
      console.error(err);
      if (err.message === "Access Denied") {
        setError("Access Denied. You are not assigned to this team.");
      } else {
        setError("Failed to load team dashboard.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-bold text-main mb-2">Loading Team Dashboard</h2>
        <p className="text-muted text-sm">Verifying secure access...</p>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="p-8 max-w-2xl mx-auto mt-12 text-center border border-red-500/20 bg-red-500/5 rounded-2xl">
        <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-main mb-2">Access Denied</h1>
        <p className="text-muted mb-6">{error}</p>
        <Button onClick={() => navigate('/portal/teams')} icon={ChevronLeft}>
          Return to My Teams
        </Button>
      </div>
    );
  }

  const tabs = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "roster", label: "Roster", icon: Users },
    { id: "sports", label: "Registered Sports", icon: Trophy },
    { id: "facility", label: "Facility Hosting", icon: MapPin },
    { id: "rules", label: "Rules & Regulations", icon: BookOpen },
    { id: "documents", label: "Documents", icon: FileText }
  ];

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-6">
      {/* Top Navigation */}
      <button 
        onClick={() => navigate('/portal/teams')}
        className="flex items-center gap-2 text-muted hover:text-main transition-colors text-sm font-medium"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to My Teams
      </button>

      {/* Header Profile Section */}
      <div className="bg-base-alt border border-border rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center gap-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-primary-500"></div>
        
        {team.logo_url ? (
          <img src={team.logo_url} alt={team.name} className="w-20 h-20 rounded-xl object-cover border border-border bg-base" />
        ) : (
          <div className="w-20 h-20 rounded-xl bg-primary-500/10 flex items-center justify-center border border-border shrink-0">
            <Building2 className="w-8 h-8 text-primary-500" />
          </div>
        )}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-main truncate">{team.name}</h1>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted">
            <span className="font-medium text-primary-400">Team Portal</span>
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
          <PortalOverviewTab team={team} />
        )}
        {activeTab === "roster" && (
          <PortalRosterTab teamId={team.id} userRole={userRole} />
        )}
        {activeTab === "sports" && (
          <PortalSportsTab teamId={team.id} />
        )}
        {activeTab === "facility" && (
          <PortalFacilityTab teamId={team.id} eventId={team.event_id} userRole={userRole} />
        )}
        {activeTab === "rules" && (
          <PortalRulesTab teamId={team.id} eventId={team.event_id} />
        )}
        {activeTab === "documents" && (
          <PortalDocumentsTab teamId={team.id} eventId={team.event_id} userRole={userRole} />
        )}
      </div>
    </div>
  );
}
