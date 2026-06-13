import React, { useState, useEffect } from "react";
import { Trophy, ShieldAlert } from "lucide-react";
import Card from "../../ui/Card";
import EmptyState from "../../ui/EmptyState";
import Badge from "../../ui/Badge";
import Button from "../../ui/Button";
import Input from "../../ui/Input";
import { useToast } from "../../ui/Toast";
import { TeamAPI } from "../../../services/teamApi";

export default function TeamSportsTab({ teamId, eventId }) {
  const [sports, setSports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newSport, setNewSport] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (teamId) {
      loadSports();
    }
  }, [teamId]);

  const loadSports = async () => {
    try {
      setLoading(true);
      const data = await TeamAPI.getTeamSports(teamId);
      setSports(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load registered sports.");
      toast.error("Failed to load sports");
    } finally {
      setLoading(false);
    }
  };

  const handleAddSport = async (e) => {
    e.preventDefault();
    if (!newSport.trim()) return;
    
    // Check for duplicate
    const isDuplicate = sports.some(s => s.sport_name.toLowerCase() === newSport.trim().toLowerCase());
    if (isDuplicate) {
      toast.error("Sport is already registered for this team.");
      return;
    }

    try {
      setIsAdding(true);
      const addedSport = await TeamAPI.addTeamSport(teamId, eventId, newSport.trim());
      setSports(prev => [...prev, addedSport]);
      setNewSport("");
      toast.success("Sport added successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to add sport");
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveSport = async (sportName) => {
    if (!window.confirm(`Are you sure you want to remove ${sportName}?`)) return;
    
    try {
      await TeamAPI.removeTeamSport(teamId, sportName);
      setSports(prev => prev.filter(s => s.sport_name !== sportName));
      toast.success("Sport removed successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove sport");
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center bg-base-alt/30 rounded-2xl border border-border">
        <div className="w-8 h-8 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-muted">Loading registered sports...</p>
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-main">Registered Sports</h2>
          <p className="text-sm text-muted">Sports this team is actively participating in.</p>
        </div>
        <form onSubmit={handleAddSport} className="flex items-end gap-2">
          <Input 
            placeholder="e.g. Football"
            value={newSport}
            onChange={(e) => setNewSport(e.target.value)}
            className="w-48"
          />
          <Button type="submit" loading={isAdding} disabled={!newSport.trim() || isAdding}>
            Add Sport
          </Button>
        </form>
      </div>

      <Card>
        {sports.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No Sports Registered"
            description="This team has not been registered for any sports yet."
          />
        ) : (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sports.map((sport) => (
              <div key={sport.id} className="bg-base border border-border rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-500/10 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-primary-500" />
                  </div>
                  <span className="font-semibold text-main">{sport.sport_name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={(!sport.status || sport.status === 'active') ? 'success' : 'warning'}>
                    {(sport.status || 'active').toUpperCase()}
                  </Badge>
                  <button
                    onClick={() => handleRemoveSport(sport.sport_name)}
                    className="p-1.5 text-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    title="Remove sport"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
