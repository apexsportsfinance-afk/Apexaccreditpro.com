// Sport-specific standings table shape. get_team_standings() returns the same
// row shape for every sport (played/won/drawn/lost/goals_for/goals_against/
// goal_diff/points/win_pct/set_ratio) - this just picks which of those fields
// to show, under which header, for a given sport's standings_type.
//
// First module of the incremental TypeScript migration (pure, no imports,
// fully unit-tested) — the data layer follows.

export type StandingsType = "" | "basketball" | "volleyball" | (string & {});

export interface StandingsTypeOption {
  value: StandingsType;
  label: string;
}

export interface StandingsColumn {
  key: string;
  header: string;
  title: string;
  highlight?: boolean;
  format?: (value: number | null | undefined) => string;
}

export const STANDINGS_TYPE_OPTIONS: StandingsTypeOption[] = [
  { value: "", label: "Football / Default (W-D-L)" },
  { value: "basketball", label: "Basketball (W-L, Win%)" },
  { value: "volleyball", label: "Volleyball (Sets)" },
];

const FOOTBALL_COLUMNS: StandingsColumn[] = [
  { key: "played", header: "P", title: "Played" },
  { key: "won", header: "W", title: "Won" },
  { key: "drawn", header: "D", title: "Drawn" },
  { key: "lost", header: "L", title: "Lost" },
  { key: "goals_for", header: "GF", title: "Goals/Points For" },
  { key: "goals_against", header: "GA", title: "Goals/Points Against" },
  { key: "goal_diff", header: "GD", title: "Goal/Point Difference" },
  { key: "points", header: "PTS", title: "Total Points", highlight: true },
];

const BASKETBALL_COLUMNS: StandingsColumn[] = [
  { key: "played", header: "P", title: "Played" },
  { key: "won", header: "W", title: "Wins" },
  { key: "lost", header: "L", title: "Losses" },
  { key: "goals_for", header: "Points Scored", title: "Total points scored by the team across all games" },
  { key: "goals_against", header: "Points Against", title: "Total points scored against the team by opponents" },
  { key: "goal_diff", header: "Point Diff", title: "Points Scored minus Points Against", format: (v) => ((v ?? 0) > 0 ? `+${v}` : `${v}`) },
  { key: "win_pct", header: "Win %", title: "Win Percentage", highlight: true, format: (v) => `${Math.round((v || 0) * 100)}%` },
];

const VOLLEYBALL_COLUMNS: StandingsColumn[] = [
  { key: "played", header: "P", title: "Played" },
  { key: "won", header: "W", title: "Won" },
  { key: "lost", header: "L", title: "Lost" },
  { key: "goals_for", header: "SW", title: "Sets Won" },
  { key: "goals_against", header: "SL", title: "Sets Lost" },
  { key: "set_ratio", header: "RATIO", title: "Set Ratio", format: (v) => (v ?? 0).toFixed(2) },
  { key: "points", header: "PTS", title: "Match Points (FIVB scoring)", highlight: true },
];

const LEGENDS: Record<string, string> = {
  basketball: "P = Played · W = Wins · L = Losses · Points Scored = total points scored across all games · Points Against = total points conceded · Point Diff = Points Scored minus Points Against · Win % = Wins / Played (ranking: Win% → Wins → Point Diff → Points Scored → head-to-head/fair play if applicable → draw of lots)",
  volleyball: "P = Played · W = Won · L = Lost · SW = Sets Won · SL = Sets Lost · RATIO = Set Ratio · PTS = Match Points, FIVB scoring (ranking: Points then Set Ratio)",
  football: "P = Played · W = Won · D = Drawn · L = Lost · GF = Goals/Points For · GA = Goals/Points Against · GD = Goal/Point Difference · PTS = Total Points",
};

export function getStandingsColumns(standingsType: StandingsType): StandingsColumn[] {
  if (standingsType === "basketball") return BASKETBALL_COLUMNS;
  if (standingsType === "volleyball") return VOLLEYBALL_COLUMNS;
  return FOOTBALL_COLUMNS;
}

export function getStandingsLegend(standingsType: StandingsType): string {
  return LEGENDS[standingsType] || LEGENDS.football;
}
