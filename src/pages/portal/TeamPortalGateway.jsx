import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Building2, ChevronRight, UserCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { TeamPortalAPI } from '../../services/teamPortalApi';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { formatDate } from '../../lib/utils';

export default function TeamPortalGateway() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.id) {
      loadMyTeams();
    }
  }, [user]);

  const loadMyTeams = async () => {
    try {
      setLoading(true);
      const assignedTeams = await TeamPortalAPI.getMyAssignedTeams(user.id);
      setTeams(assignedTeams || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load your assigned teams. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin': return <Badge variant="primary">Admin</Badge>;
      case 'manager': return <Badge variant="success">Manager</Badge>;
      case 'coach': return <Badge variant="warning">Coach</Badge>;
      case 'viewer': return <Badge variant="neutral">Viewer</Badge>;
      default: return <Badge variant="neutral">{role}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-bold text-main mb-2">Loading Team Portal</h2>
        <p className="text-muted text-sm">Verifying your secure assignments...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 max-w-2xl mx-auto mt-12 text-center border border-red-500/20 bg-red-500/5 rounded-2xl">
        <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-main mb-2">Connection Error</h1>
        <p className="text-muted">{error}</p>
        <Button onClick={loadMyTeams} className="mt-6">Retry Connection</Button>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="p-8 max-w-2xl mx-auto mt-12 text-center">
        <div className="w-24 h-24 bg-base-alt rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-border">
          <UserCircle className="w-12 h-12 text-muted" />
        </div>
        <h1 className="text-2xl font-bold text-main mb-3">No Teams Assigned</h1>
        <p className="text-muted max-w-md mx-auto leading-relaxed">
          You currently do not have access to any teams in the portal. 
          If you believe this is an error, please contact the Event Administrator to request an assignment.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-main mb-2">My Teams</h1>
        <p className="text-muted">Select a team below to manage its profile and documentation.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map((team) => (
          <button
            key={team.id}
            onClick={() => navigate(`/portal/teams/${team.id}`)}
            className="group flex flex-col text-left bg-base-alt border border-border hover:border-primary-500/50 rounded-2xl p-6 transition-all duration-300 hover:shadow-lg hover:shadow-primary-500/5 hover:-translate-y-1"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-16 h-16 rounded-xl bg-base border border-border flex items-center justify-center shrink-0 overflow-hidden">
                {team.logo_url ? (
                  <img src={team.logo_url} alt={team.name} className="w-full h-full object-cover" />
                ) : (
                  <Building2 className="w-8 h-8 text-muted" />
                )}
              </div>
              <div className="bg-base border border-border p-2 rounded-lg text-muted group-hover:text-primary-500 transition-colors">
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>

            <div className="flex-1">
              <h3 className="text-xl font-bold text-main mb-1 truncate">{team.name}</h3>
              <p className="text-sm text-muted mb-4 truncate">{team.city || 'No city'}, {team.country || 'No country'}</p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-border mt-auto">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">Role:</span>
                {getRoleBadge(team.my_role)}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
