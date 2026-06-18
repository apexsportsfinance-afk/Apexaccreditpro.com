// Sport-specific standings table shape. get_team_standings() returns the same
// row shape for every sport (played/won/drawn/lost/goals_for/goals_against/
// goal_diff/points/win_pct/set_ratio) - this just picks which of those fields
// to show, under which header, for a given sport's standings_type.

export const STANDINGS_TYPE_OPTIONS = [
  { value: "", label: "Football / Default (W-D-L)" },
  { value: "basketball", label: "Basketball (W-L, Win%)" },
  { value: "volleyball", label: "Volleyball (Sets)" },
];

const FOOTBALL_COLUMNS = [
  { key: "played", header: "P", title: "Played" },
  { key: "won", header: "W", title: "Won" },
  { key: "drawn", header: "D", title: "Drawn" },
  { key: "lost", header: "L", title: "Lost" },
  { key: "goals_for", header: "GF", title: "Goals/Points For" },
  { key: "goals_against", header: "GA", title: "Goals/Points Against" },
  { key: "goal_diff", header: "GD", title: "Goal/Point Difference" },
  { key: "points", header: "PTS", title: "Total Points", highlight: true },
];

const BASKETBALL_COLUMNS = [
  { key: "played", header: "P", title: "Played" },
  { key: "won", header: "W", title: "Won" },
  { key: "lost", header: "L", title: "Lost" },
  { key: "goals_for", header: "PF", title: "Points For" },
  { key: "goals_against", header: "PA", title: "Points Against" },
  { key: "goal_diff", header: "DIFF", title: "Point Difference" },
  { key: "win_pct", header: "WIN%", title: "Win Percentage", highlight: true, format: (v) => `${Math.round((v || 0) * 100)}%` },
];

const VOLLEYBALL_COLUMNS = [
  { key: "played", header: "P", title: "Played" },
  { key: "won", header: "W", title: "Won" },
  { key: "lost", header: "L", title: "Lost" },
  { key: "goals_for", header: "SW", title: "Sets Won" },
  { key: "goals_against", header: "SL", title: "Sets Lost" },
  { key: "set_ratio", header: "RATIO", title: "Set Ratio", format: (v) => (v ?? 0).toFixed(2) },
  { key: "points", header: "PTS", title: "Match Points (FIVB scoring)", highlight: true },
];

const LEGENDS = {
  basketball: "P = Played · W = Won · L = Lost · PF = Points For · PA = Points Against · DIFF = Point Difference · WIN% = Win Percentage (ranking: Win% then Point Difference)",
  volleyball: "P = Played · W = Won · L = Lost · SW = Sets Won · SL = Sets Lost · RATIO = Set Ratio · PTS = Match Points, FIVB scoring (ranking: Points then Set Ratio)",
  football: "P = Played · W = Won · D = Drawn · L = Lost · GF = Goals/Points For · GA = Goals/Points Against · GD = Goal/Point Difference · PTS = Total Points",
};

export function getStandingsColumns(standingsType) {
  if (standingsType === "basketball") return BASKETBALL_COLUMNS;
  if (standingsType === "volleyball") return VOLLEYBALL_COLUMNS;
  return FOOTBALL_COLUMNS;
}

export function getStandingsLegend(standingsType) {
  return LEGENDS[standingsType] || LEGENDS.football;
}
