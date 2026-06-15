// ==============================================================================
// PHASE 4: Competition format builder - fixture/bracket generation.
//
// Every generator below is a pure function: it takes a list of teams
// ({ id, name }) plus format-specific options, and returns an array of
// "fixture" objects:
//
//   { match_title, team_a_id, team_a_name, team_b_id, team_b_name, round_offset }
//
// `round_offset` is a 0-based integer used purely for scheduling - the caller
// (buildMatchRows) turns it into an actual match_date by adding
// `round_offset * daysBetweenRounds` days to a chosen start date.
//
// For knockout-style formats, later rounds reference teams that aren't known
// yet (e.g. "Winner of Semifinal 1"). Those are represented as
// team_a_id/team_b_id = null with a descriptive team_a_name/team_b_name, the
// same way a manually-entered "TBD" match would look. Admins can edit these
// rows once real results are known.
// ==============================================================================

export const FORMAT_OPTIONS = [
  { value: "Round Robin", label: "Round Robin", description: "Every team plays every other team once (or twice for Home & Away)." },
  { value: "Groups + Knockout", label: "Groups + Knockout / Pool Play", description: "Teams split into groups for a round-robin stage, then top finishers advance to a knockout bracket." },
  { value: "Single Elimination", label: "Single Elimination", description: "Standard knockout bracket - lose once and you're out." },
  { value: "Double Elimination", label: "Double Elimination", description: "Knockout bracket with a losers' bracket - a team is eliminated only after a second loss." },
  { value: "Conference", label: "Conference", description: "Teams split into conferences/divisions, each playing a round-robin, with a championship crossover." },
  { value: "Individual", label: "Individual / Heat Sheet", description: "For sports like Swimming or Athletics with no team-vs-team matches. Manage the event schedule and results via the Sport Events & Heat Sheets tab." },
  { value: "Custom", label: "Custom (Manual)", description: "No automatic fixtures - add and manage matches manually below." },
];

function nextPowerOfTwo(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// Standard tournament seeding order, e.g. seedOrder(8) = [1,8,4,5,2,7,3,6]
// meaning round-1 pairs are (1v8),(4v5),(2v7),(3v6).
function seedOrder(n) {
  let result = [1];
  while (result.length < n) {
    const len = result.length * 2;
    const next = [];
    result.forEach((r) => next.push(r, len + 1 - r));
    result = next;
  }
  return result;
}

function roundLabel(roundNum, totalRounds, prefix = "") {
  const remaining = totalRounds - roundNum;
  let label;
  if (remaining === 0) label = "Final";
  else if (remaining === 1) label = "Semifinal";
  else if (remaining === 2) label = "Quarterfinal";
  else if (remaining === 3) label = "Round of 16";
  else label = `Round ${roundNum}`;
  return prefix ? `${prefix}${label}` : label;
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

// --- Round Robin (circle method) --------------------------------------------

export function generateRoundRobin(teams, { doubleRound = false } = {}) {
  if (teams.length < 2) return [];
  const list = [...teams];
  if (list.length % 2 !== 0) list.push({ id: null, name: "BYE" });
  const n = list.length;
  const numRounds = n - 1;
  const matches = [];
  let arr = [...list];

  for (let round = 0; round < numRounds; round++) {
    for (let i = 0; i < n / 2; i++) {
      const home = arr[i];
      const away = arr[n - 1 - i];
      if (home.name === "BYE" || away.name === "BYE") continue;
      matches.push({
        match_title: `Round ${round + 1}`,
        team_a_id: home.id || null,
        team_a_name: home.name,
        team_b_id: away.id || null,
        team_b_name: away.name,
        round_offset: round,
      });
    }
    // Rotate everyone except the fixed first team (classic circle method).
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }

  if (doubleRound) {
    const firstLegCount = matches.length;
    for (let i = 0; i < firstLegCount; i++) {
      const m = matches[i];
      matches.push({
        match_title: `Round ${numRounds + m.round_offset + 1}`,
        team_a_id: m.team_b_id,
        team_a_name: m.team_b_name,
        team_b_id: m.team_a_id,
        team_b_name: m.team_a_name,
        round_offset: numRounds + m.round_offset,
      });
    }
  }

  return matches;
}

// --- Knockout bracket core ---------------------------------------------------
// A "slot" is either:
//   - null                          -> empty / bye
//   - { id, name }                  -> a known team (or group placeholder)
//   - { tbd: true, label: "..." }   -> winner/loser of an earlier match, TBD

function pairSlots(slots) {
  const pairs = [];
  for (let i = 0; i < slots.length; i += 2) {
    pairs.push([slots[i], i + 1 < slots.length ? slots[i + 1] : null]);
  }
  return pairs;
}

// Pairs two slots into a match descriptor. If either slot is empty, the other
// auto-advances with no match created (a "bye").
function makeMatch(matchTitle, a, b) {
  if (a && b) {
    return {
      created: true,
      matchTitle,
      teamA: a,
      teamB: b,
      winnerSlot: { tbd: true, label: `Winner of ${matchTitle}` },
      loserSlot: { tbd: true, label: `Loser of ${matchTitle}` },
    };
  }
  return { created: false, winnerSlot: a || b || null, loserSlot: null };
}

function toMatchRow(m, roundOffset) {
  return {
    match_title: m.matchTitle,
    team_a_id: m.teamA.id ?? null,
    team_a_name: m.teamA.tbd ? m.teamA.label : m.teamA.name,
    team_b_id: m.teamB.id ?? null,
    team_b_name: m.teamB.tbd ? m.teamB.label : m.teamB.name,
    round_offset: roundOffset,
  };
}

function buildInitialSlots(teams, bracketSize) {
  const order = seedOrder(bracketSize);
  return order.map((seed) => (seed <= teams.length ? teams[seed - 1] : null));
}

// Builds every round of a single-elimination bracket from a list of initial
// slots, labeling matches (Final / Semifinal / Quarterfinal / Round of 16 /
// Round N) and tracking winner+loser placeholders for later rounds.
function buildBracketRounds(slots, totalRounds, prefix = "") {
  let current = slots;
  const rounds = [];

  for (let r = 1; r <= totalRounds; r++) {
    const pairs = pairSlots(current);
    const matches = pairs.map(([a, b]) => makeMatch("", a, b));
    const createdCount = matches.filter((m) => m.created).length;
    let labelIdx = 0;
    matches.forEach((m) => {
      if (!m.created) return;
      labelIdx++;
      const base = roundLabel(r, totalRounds, prefix);
      m.matchTitle = createdCount > 1 ? `${base} ${labelIdx}` : base;
      m.winnerSlot = { tbd: true, label: `Winner of ${m.matchTitle}` };
      m.loserSlot = { tbd: true, label: `Loser of ${m.matchTitle}` };
    });
    rounds.push(matches);
    current = matches.map((m) => m.winnerSlot);
  }

  return { rounds, champion: current[0] || null };
}

// --- Single Elimination -------------------------------------------------------

export function generateSingleElimination(teams, { prefix = "" } = {}) {
  if (teams.length < 2) return [];
  const bracketSize = nextPowerOfTwo(teams.length);
  const totalRounds = Math.log2(bracketSize);
  const slots = buildInitialSlots(teams, bracketSize);
  const { rounds } = buildBracketRounds(slots, totalRounds, prefix);

  const matches = [];
  rounds.forEach((round, ri) => {
    round.forEach((m) => {
      if (m.created) matches.push(toMatchRow(m, ri));
    });
  });
  return matches;
}

// --- Double Elimination --------------------------------------------------------
// Winners bracket = single elimination. Losers bracket re-pairs each round's
// losers (consolidation rounds alternate with "drop-down" rounds that feed in
// the next winners-bracket round's losers), ending in an LB Final against the
// WB Final's loser, followed by a Grand Final (WB champion vs LB champion).
// This produces a structurally valid double-elim skeleton; admins can adjust
// individual fixtures afterwards as results come in.

export function generateDoubleElimination(teams) {
  if (teams.length < 2) return [];
  const bracketSize = nextPowerOfTwo(teams.length);
  const totalRounds = Math.log2(bracketSize);
  const slots = buildInitialSlots(teams, bracketSize);
  const wb = buildBracketRounds(slots, totalRounds, "WB ");

  const matches = [];
  wb.rounds.forEach((round, ri) => {
    round.forEach((m) => {
      if (m.created) matches.push(toMatchRow(m, ri));
    });
  });

  if (totalRounds < 2) return matches; // 2-team bracket: WB final IS the final.

  const wbLosersByRound = wb.rounds.map((round) => round.map((m) => m.loserSlot));
  let lbSurvivors = wbLosersByRound[0].filter(Boolean);
  let lbRoundNum = 0;

  for (let i = 1; i <= totalRounds - 1; i++) {
    // Consolidation round: LB survivors face each other.
    lbRoundNum++;
    const consolPairs = pairSlots(lbSurvivors);
    const consolMatches = consolPairs.map(([a, b]) => makeMatch("", a, b));
    const consolCreated = consolMatches.filter((m) => m.created).length;
    let idx = 0;
    consolMatches.forEach((m) => {
      if (!m.created) return;
      idx++;
      m.matchTitle = consolCreated > 1 ? `LB Round ${lbRoundNum} - Match ${idx}` : `LB Round ${lbRoundNum}`;
      m.winnerSlot = { tbd: true, label: `Winner of ${m.matchTitle}` };
      matches.push(toMatchRow(m, totalRounds + lbRoundNum - 1));
    });
    const consolWinners = consolMatches.map((m) => m.winnerSlot);

    // Drop-down round: consolidation winners face this WB round's losers.
    lbRoundNum++;
    const dropLosers = wbLosersByRound[i].filter(Boolean);
    const dropPairs = consolWinners.map((w, k) => [w, k < dropLosers.length ? dropLosers[k] : null]);
    const dropMatches = dropPairs.map(([a, b]) => makeMatch("", a, b));
    const dropCreated = dropMatches.filter((m) => m.created).length;
    let didx = 0;
    dropMatches.forEach((m) => {
      if (!m.created) return;
      didx++;
      m.matchTitle = dropCreated > 1 ? `LB Round ${lbRoundNum} - Match ${didx}` : `LB Round ${lbRoundNum}`;
      m.winnerSlot = { tbd: true, label: `Winner of ${m.matchTitle}` };
      matches.push(toMatchRow(m, totalRounds + lbRoundNum - 1));
    });
    lbSurvivors = dropMatches.map((m) => m.winnerSlot);
  }

  if (wb.champion && lbSurvivors[0]) {
    const gf = makeMatch("Grand Final", wb.champion, lbSurvivors[0]);
    if (gf.created) matches.push(toMatchRow(gf, totalRounds + lbRoundNum));
  }

  return matches;
}

// --- Groups + Knockout / Pool Play ---------------------------------------------

export function generateGroups(teams, { numGroups = 2, advancePerGroup = 2, label = "Group", groups: customGroups = null } = {}) {
  numGroups = Math.max(1, Math.min(numGroups, teams.length));

  let groups;
  if (customGroups && customGroups.length > 0) {
    groups = customGroups;
  } else {
    groups = Array.from({ length: numGroups }, () => []);
    teams.forEach((t, i) => groups[i % numGroups].push(t));
  }

  const matches = [];
  let maxRoundOffset = -1;
  groups.forEach((groupTeams, gi) => {
    if (groupTeams.length < 2) return;
    const groupLabel = String.fromCharCode(65 + gi);
    generateRoundRobin(groupTeams).forEach((m) => {
      matches.push({ ...m, match_title: `${label} ${groupLabel} - ${m.match_title}` });
      if (m.round_offset > maxRoundOffset) maxRoundOffset = m.round_offset;
    });
  });

  if (advancePerGroup > 0 && numGroups >= 2) {
    const placeholders = [];
    for (let pos = 1; pos <= advancePerGroup; pos++) {
      groups.forEach((g, gi) => {
        if (g.length === 0) return;
        placeholders.push({ id: null, name: `${ordinal(pos)} - ${label} ${String.fromCharCode(65 + gi)}` });
      });
    }
    if (placeholders.length >= 2) {
      generateSingleElimination(placeholders).forEach((m) => {
        matches.push({ ...m, round_offset: maxRoundOffset + 1 + m.round_offset });
      });
    }
  }

  return matches;
}

// --- Conference -------------------------------------------------------------
// `groups`, if provided, is an array of team-arrays (e.g. derived from
// existing competition_divisions assignments). Falls back to an even split
// into `numConferences` groups by input order.

export function generateConference(teams, { numConferences = 2, groups = null, crossoverFinal = true } = {}) {
  let conferences = groups ? groups.filter((g) => g.length > 0) : [];
  if (conferences.length < 2) {
    const size = Math.max(2, numConferences);
    const arr = Array.from({ length: size }, () => []);
    teams.forEach((t, i) => arr[i % size].push(t));
    conferences = arr.filter((g) => g.length > 0);
  }

  const matches = [];
  let maxRoundOffset = -1;
  conferences.forEach((confTeams, ci) => {
    if (confTeams.length < 2) return;
    generateRoundRobin(confTeams).forEach((m) => {
      matches.push({ ...m, match_title: `Conference ${ci + 1} - ${m.match_title}` });
      if (m.round_offset > maxRoundOffset) maxRoundOffset = m.round_offset;
    });
  });

  if (crossoverFinal && conferences.length === 2 && conferences.every((c) => c.length > 0)) {
    matches.push({
      match_title: "Conference Championship",
      team_a_id: null,
      team_a_name: "Conference 1 Champion",
      team_b_id: null,
      team_b_name: "Conference 2 Champion",
      round_offset: maxRoundOffset + 1,
    });
  }

  return matches;
}

// --- Dispatcher + row builder ------------------------------------------------

export function generateFixtures(format, teams, options = {}) {
  switch (format) {
    case "Round Robin":
      return generateRoundRobin(teams, { doubleRound: !!options.doubleRound });
    case "Groups + Knockout":
      return generateGroups(teams, {
        numGroups: options.numGroups || 2,
        advancePerGroup: options.advancePerGroup ?? 2,
        label: options.groupLabel || "Group",
        groups: options.manualGroups || null,
      });
    case "Single Elimination":
      return generateSingleElimination(teams);
    case "Double Elimination":
      return generateDoubleElimination(teams);
    case "Conference":
      return generateConference(teams, {
        numConferences: options.numConferences || 2,
        groups: options.divisionGroups || null,
      });
    default:
      return [];
  }
}

// Turns abstract fixtures (with round_offset) into live_score_matches insert
// rows, spacing rounds `daysBetweenRounds` days apart starting from
// `startDate` (YYYY-MM-DD).
export function buildMatchRows(fixtures, { eventId, sportId, startDate, daysBetweenRounds = 7, venue = "", status = "Upcoming" } = {}) {
  const base = startDate ? new Date(`${startDate}T00:00:00`) : new Date();
  return fixtures.map((f) => {
    const date = new Date(base);
    date.setDate(date.getDate() + (f.round_offset || 0) * daysBetweenRounds);
    return {
      event_id: eventId,
      sport_id: sportId,
      match_title: f.match_title,
      team_a_id: f.team_a_id || null,
      team_a_name: f.team_a_name,
      team_b_id: f.team_b_id || null,
      team_b_name: f.team_b_name,
      team_a_score: "0",
      team_b_score: "0",
      match_date: date.toISOString().split("T")[0],
      match_time: "12:00",
      venue: venue || "",
      status,
      notes: "",
    };
  });
}
