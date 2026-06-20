// Sport-specific player match-statistics fields. Keyed off the same
// `live_score_sports.standings_type` value already used by standingsColumns.ts
// ("" = Football/Default, "basketball", "volleyball"), so adding a stat field
// set for a sport reuses the same per-sport switch admins already configure
// in "Manage Sports" -> Standings Type.

export type StandingsType = "" | "basketball" | "volleyball" | (string & {});

export interface StatField {
  key: string;
  label: string;
  short: string;
}

const FOOTBALL_FIELDS: StatField[] = [
  { key: "goals", label: "Goals", short: "G" },
  { key: "assists", label: "Assists", short: "A" },
  { key: "yellow_cards", label: "Yellow Cards", short: "YC" },
  { key: "red_cards", label: "Red Cards", short: "RC" },
];

const BASKETBALL_FIELDS: StatField[] = [
  { key: "points", label: "Points", short: "PTS" },
  { key: "three_pointers", label: "3-Pointers Made", short: "3PM" },
  { key: "rebounds", label: "Rebounds", short: "REB" },
  { key: "assists", label: "Assists", short: "AST" },
  { key: "fouls", label: "Fouls", short: "F" },
];

const VOLLEYBALL_FIELDS: StatField[] = [
  { key: "points", label: "Points", short: "PTS" },
  { key: "aces", label: "Aces", short: "ACE" },
  { key: "blocks", label: "Blocks", short: "BLK" },
  { key: "attacks", label: "Attacks / Spikes", short: "ATT" },
  { key: "reception_errors", label: "Reception Errors", short: "RE" },
  { key: "service_errors", label: "Service Errors", short: "SE" },
];

export function getStatFieldsForSport(standingsType: StandingsType): StatField[] {
  if (standingsType === "basketball") return BASKETBALL_FIELDS;
  if (standingsType === "volleyball") return VOLLEYBALL_FIELDS;
  return FOOTBALL_FIELDS;
}

export function getSportStatLabel(standingsType: StandingsType): string {
  if (standingsType === "basketball") return "Basketball";
  if (standingsType === "volleyball") return "Volleyball";
  return "Football";
}
