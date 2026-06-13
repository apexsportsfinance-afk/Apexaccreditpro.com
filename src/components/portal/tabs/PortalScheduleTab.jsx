import React, { useState, useEffect, useMemo } from "react";
import { Calendar, Clock, MapPin, Trophy, ShieldAlert, Users } from "lucide-react";
import Card from "../../ui/Card";
import Badge from "../../ui/Badge";
import EmptyState from "../../ui/EmptyState";
import { TeamPortalAPI } from "../../../services/teamPortalApi";
import { LiveScoresAPI } from "../../../lib/storage";
import { formatDate } from "../../../lib/utils";

const STATUS_VARIANTS = {
  Upcoming: "info",
  Live: "danger",
  "Half Time / Break": "warning",
  Finished: "muted",
  Cancelled: "muted",
  Postponed: "warning",
};

const STATUS_FILTER_OPTIONS = ["Upcoming", "Live", "Half Time / Break", "Finished", "Cancelled", "Postponed"];

const STANDINGS_LEGEND = "P = Played · W = Won · D = Drawn · L = Lost · GF = Goals/Points For · GA = Goals/Points Against · GD = Goal/Point Difference · PTS = Total Points";

export default function PortalScheduleTab({ teamId, eventId }) {
  const [view, setView] = useState("fixtures");
  const [matches, setMatches] = useState([]);
  const [sports, setSports] = useState([]);
  const [selectedSportId, setSelectedSportId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all"); // "all" | "mine"
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (teamId && eventId) load();
  }, [teamId, eventId]);

  useEffect(() => {
    if (eventId && selectedSportId) loadStandings(selectedSportId);
  }, [eventId, selectedSportId]);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [matchesData, sportsData, teamSportsData] = await Promise.all([
        LiveScoresAPI.getMatches(eventId),
        LiveScoresAPI.getSports(eventId),
        TeamPortalAPI.getPortalTeamSports(teamId),
      ]);
      setMatches(matchesData);
      setSports(sportsData);

      if (sportsData.length > 0) {
        const myNames = new Set((teamSportsData || []).map((s) => s.sport_name.toLowerCase()));
        const match = sportsData.find((s) => myNames.has(s.sport_name.toLowerCase()));
        setSelectedSportId((match || sportsData[0]).id);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load schedule.");
    } finally {
      setLoading(false);
    }
  };

  const loadStandings = async (sportId) => {
    try {
      setStandingsLoading(true);
      const data = await TeamPortalAPI.getStandings(eventId, sportId);
      setStandings(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setStandingsLoading(false);
    }
  };

  const displayedFixtures = useMemo(() => {
    return matches.filter((m) => {
      if (selectedSportId && m.sport_id !== selectedSportId) return false;
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      if (scopeFilter === "mine" && m.team_a_id !== teamId && m.team_b_id !== teamId) return false;
      return true;
    });
  }, [matches, selectedSportId, statusFilter, scopeFilter, teamId]);

  if (loading) {
    return (
      <div className="p-12 text-center bg-base-alt/30 rounded-2xl border border-border">
        <div className="w-8 h-8 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-muted">Loading schedule...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12 text-center bg-base-alt/30 rounded-2xl border border-border">
        <ShieldAlert className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-main font-medium">Error loading schedule</p>
        <p className="text-muted text-sm">{error}</p>
      </div>
    );
  }

  if (sports.length === 0) {
    return (
      <div className="p-12 text-center bg-base-alt/30 rounded-2xl border border-border">
        <Calendar className="w-12 h-12 text-muted mx-auto mb-3" />
        <p className="text-main font-medium">Schedule not configured yet</p>
        <p className="text-muted text-sm">The event organizer hasn't added any sports to Live Scores yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-bold text-main">Schedule & Standings</h2>
          <p className="text-sm text-muted">Fixtures and the league table for your sport.</p>
        </div>
        <div className="flex items-center gap-2 bg-base-alt/50 border border-border rounded-lg p-1">
          <button
            onClick={() => setView("fixtures")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "fixtures" ? "bg-primary-500 text-white" : "text-muted hover:text-main"}`}
          >
            Fixtures
          </button>
          <button
            onClick={() => setView("standings")}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "standings" ? "bg-primary-500 text-white" : "text-muted hover:text-main"}`}
          >
            Standings
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap bg-base-alt/30 border border-border rounded-xl p-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-muted uppercase tracking-wider">Sport</label>
          <select
            value={selectedSportId}
            onChange={(e) => setSelectedSportId(e.target.value)}
            className="px-3 py-1.5 bg-base border border-border rounded-lg text-sm text-main focus:outline-none focus:border-primary-500"
          >
            {sports.map((s) => (
              <option key={s.id} value={s.id}>{s.sport_name}</option>
            ))}
          </select>
        </div>

        {view === "fixtures" && (
          <>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 bg-base border border-border rounded-lg text-sm text-main focus:outline-none focus:border-primary-500"
              >
                <option value="all">All Statuses</option>
                {STATUS_FILTER_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-base border border-border rounded-lg p-1 ml-auto">
              <button
                onClick={() => setScopeFilter("all")}
                className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${scopeFilter === "all" ? "bg-primary-500 text-white" : "text-muted hover:text-main"}`}
              >
                All Teams
              </button>
              <button
                onClick={() => setScopeFilter("mine")}
                className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 ${scopeFilter === "mine" ? "bg-primary-500 text-white" : "text-muted hover:text-main"}`}
              >
                <Users className="w-3 h-3" /> My Team Only
              </button>
            </div>
          </>
        )}
      </div>

      {view === "fixtures" ? (
        <Card>
          {displayedFixtures.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No Fixtures Found"
              description="No fixtures match the selected filters yet."
            />
          ) : (
            <div className="divide-y divide-border/50">
              {displayedFixtures.map((m) => (
                <div key={m.id} className="p-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={STATUS_VARIANTS[m.status] || "info"}>{m.status}</Badge>
                    {m.match_title && <span className="text-xs text-muted">{m.match_title}</span>}
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <p className="font-semibold text-main text-right flex-1 truncate">{m.team_a_name || "TBA"}</p>
                    {(m.status === "Live" || m.status === "Half Time / Break" || m.status === "Finished") ? (
                      <div className="text-center px-3 py-1.5 bg-base-alt/50 rounded-lg border border-border shrink-0">
                        <span className="text-lg font-black text-main">{m.team_a_score} - {m.team_b_score}</span>
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-muted shrink-0 px-3">vs</span>
                    )}
                    <p className="font-semibold text-main flex-1 truncate">{m.team_b_name || "TBA"}</p>
                  </div>
                  <div className="flex items-center justify-center gap-3 text-xs text-muted flex-wrap">
                    {m.match_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {formatDate(m.match_date)}
                      </span>
                    )}
                    {m.match_time && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {m.match_time}
                      </span>
                    )}
                    {m.venue && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {m.venue}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-4 space-y-4">
          {standingsLoading ? (
            <p className="text-muted text-sm p-4">Loading standings...</p>
          ) : standings.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="No Standings Yet"
              description="The league table will appear once matches between teams are marked Finished."
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted text-xs uppercase tracking-widest">
                      <th className="py-2 pr-4">#</th>
                      <th className="py-2 pr-4">Team</th>
                      <th className="py-2 pr-3 text-center" title="Played">P</th>
                      <th className="py-2 pr-3 text-center" title="Won">W</th>
                      <th className="py-2 pr-3 text-center" title="Drawn">D</th>
                      <th className="py-2 pr-3 text-center" title="Lost">L</th>
                      <th className="py-2 pr-3 text-center" title="Goals/Points For">GF</th>
                      <th className="py-2 pr-3 text-center" title="Goals/Points Against">GA</th>
                      <th className="py-2 pr-3 text-center" title="Goal/Point Difference">GD</th>
                      <th className="py-2 pr-3 text-center" title="Total Points">PTS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {standings.map((row, i) => (
                      <tr key={row.team_id} className={row.team_id === teamId ? "bg-primary-500/5 font-bold text-main" : "text-main"}>
                        <td className="py-2 pr-4 text-muted">{i + 1}</td>
                        <td className="py-2 pr-4">{row.team_name}</td>
                        <td className="py-2 pr-3 text-center">{row.played}</td>
                        <td className="py-2 pr-3 text-center">{row.won}</td>
                        <td className="py-2 pr-3 text-center">{row.drawn}</td>
                        <td className="py-2 pr-3 text-center">{row.lost}</td>
                        <td className="py-2 pr-3 text-center">{row.goals_for}</td>
                        <td className="py-2 pr-3 text-center">{row.goals_against}</td>
                        <td className="py-2 pr-3 text-center">{row.goal_diff}</td>
                        <td className="py-2 pr-3 text-center font-black text-primary-500">{row.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-muted leading-relaxed">{STANDINGS_LEGEND}</p>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
