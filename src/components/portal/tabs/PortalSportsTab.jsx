import React, { useState, useEffect } from "react";
import { Trophy, ShieldAlert } from "lucide-react";
import Card from "../../ui/Card";
import EmptyState from "../../ui/EmptyState";
import { TeamPortalAPI } from "../../../services/teamPortalApi";
import Badge from "../../ui/Badge";

export default function PortalSportsTab({ teamId }) {
  const [sports, setSports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (teamId) {
      loadSports();
    }
  }, [teamId]);

  const loadSports = async () => {
    try {
      setLoading(true);
      const data = await TeamPortalAPI.getPortalTeamSports(teamId);
      setSports(data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load registered sports.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center bg-base-alt/30 rounded-2xl border border-border">
        <div className="w-8 h-8 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-muted">Loading sports...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12 text-center bg-base-alt/30 rounded-2xl border border-border">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-main font-medium">Error loading sports</p>
        <p className="text-muted text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-main">Registered Sports</h2>
          <p className="text-sm text-muted">Sports this team is currently registered for.</p>
        </div>
      </div>

      <Card>
        {sports.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No Sports Registered"
            description="This team has not been registered for any sports yet."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sports.map((sport) => (
              <div 
                key={sport.id} 
                className="p-4 rounded-xl border border-border bg-base flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-full bg-primary-500/10 flex items-center justify-center shrink-0">
                  <Trophy className="w-6 h-6 text-primary-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-main truncate">{sport.sport_name}</h3>
                  <div className="mt-1">
                    <Badge variant={sport.status === 'active' ? 'success' : 'warning'}>
                      {(sport.status || 'active').toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
