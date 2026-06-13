import React, { useState, useEffect } from "react";
import { Calendar, Clock, MapPin, Trophy, ShieldAlert } from "lucide-react";
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
};

export default function PortalScheduleTab({ teamId, eventId }) {
  const [view, setView] = useState("fixtures");
  const [fixtures, setFixtures] = useState([]);
  const [sports, setSports] = useState([]);
  const [standingsSportId, setStandingsSportId] = useState("");
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (teamId && eventId) load();
  }, [teamId, eventId]);

  useEffect(() => {
    if (eventId && standingsSportId) loadStandings(standingsSportId);
  }, [eventId, standingsSportId]);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [fixturesData, sportsData, teamSportsData] = await Promise.all([
        TeamPortalAPI.getTeamFixtures(teamId),
        LiveScoresAPI.getSports(eventId),
        TeamPortalAPI.getPortalTeamSports(teamId),
      ]);
      setFixtures(fixturesData);
      setSports(sportsData);

      if (sportsData.length > 0) {
        const myNames = new Set((teamSportsData || []).map((s) => s.sport_name.toLowerCase()));
        const match = sportsData.find((s) => myNames.has(s.sport_name.toLowerCase()));
        setStandingsSportId((match || sportsData[0]).id);
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

  const getOpponent = (match) => (match.team_a_id === teamId ? (match.team_b_name || "TBA") : (match.team_a_name || "TBA"));
  const getMyScore = (match) => (match.team_a_id === teamId ? match.team_a_score : match.team_b_score);
  const getOpponentScore = (match) => (match.team_a_id === teamId ? match.team_b_score : match.team_a_score);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-bold text-main">Schedule & Standings</h2>
          <p className="text-sm text-muted">Your team's fixtures and the league table for your sport.</p>
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

      {view === "fixtures" ? (
        <Card>
          {fixtures.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No Fixtures Yet"
              description="Your team's matches will appear here once the event organizer schedules them."
            />
          ) : (
            <div className="divide-y divide-border/50">
              {fixtures.map((m) => (
                <div key={m.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant={STATUS_VARIANTS[m.status] || "info"}>{m.status}</Badge>
                      {m.live_score_sports?.sport_name && <Badge variant="muted">{m.live_score_sports.sport_name}</Badge>}
                      {m.match_title && <span className="text-xs text-muted">{m.match_title}</span>}
                    </div>
                    <p className="font-semibold text-main">vs {getOpponent(m)}</p>
                    <div className="flex items-center gap-3 text-xs text-muted mt-1 flex-wrap">
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
                  {(m.status === "Finished" || m.status === "Live") && (
                    <div className="text-center px-4 py-2 bg-base-alt/50 rounded-lg border border-border shrink-0">
                      <span className="text-xl font-black text-main">{getMyScore(m)} - {getOpponentScore(m)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-4 space-y-4">
          {sports.length > 1 && (
            <div className="flex justify-end">
              <select
                value={standingsSportId}
                onChange={(e) => setStandingsSportId(e.target.value)}
                className="px-3 py-2 bg-base border border-border rounded-lg text-sm text-main focus:outline-none focus:border-primary-500"
              >
                {sports.map((s) => (
                  <option key={s.id} value={s.id}>{s.sport_name}</option>
                ))}
              </select>
            </div>
          )}
          {standingsLoading ? (
            <p className="text-muted text-sm p-4">Loading standings...</p>
          ) : standings.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="No Standings Yet"
              description="The league table will appear once matches between teams are marked Finished."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted text-xs uppercase tracking-widest">
                    <th className="py-2 pr-4">#</th>
                    <th className="py-2 pr-4">Team</th>
                    <th className="py-2 pr-3 text-center">P</th>
                    <th className="py-2 pr-3 text-center">W</th>
                    <th className="py-2 pr-3 text-center">D</th>
                    <th className="py-2 pr-3 text-center">L</th>
                    <th className="py-2 pr-3 text-center">GF</th>
                    <th className="py-2 pr-3 text-center">GA</th>
                    <th className="py-2 pr-3 text-center">GD</th>
                    <th className="py-2 pr-3 text-center">Pts</th>
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
          )}
        </Card>
      )}
    </div>
  );
}
