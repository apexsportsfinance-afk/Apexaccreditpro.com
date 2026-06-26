// ==============================================================================
// Fixture "Chart" export — a visual bracket / flow PDF.
//
// This is an ADDITIVE, read-only export. It consumes the same `matches` array
// the Excel / PDF Schedule / PNG exports already read and produces a clean
// tournament-bracket PDF (event + sport + round + group + team names + logos +
// connector lines showing progression). It writes nothing back and does not
// touch fixture generation, scheduling, match data, or any other export.
//
// Layout strategy
// ---------------
// Auto-generated fixtures encode their own structure (see lib/fixtureGenerators):
//   • `stage`        — 'league' | 'group' | 'knockout' | 'playoff' | 'final'
//   • `match_title`  — round labels ("Final", "Semifinal 1", "Quarterfinal 2",
//                      "Round of 16 3", "WB ...", "LB Round 2 - Match 1",
//                      "Group A - Round 1", ...)
//   • placeholder names — a later match stores team_a_name / team_b_name like
//                      "Winner of Semifinal 1" / "Loser of Quarterfinal 2",
//                      which references the feeder match by its title.
//
// We rebuild the bracket tree primarily from those "Winner/Loser of <title>"
// links (robust for freshly generated brackets) and fall back to round-label
// ranking when links have been overwritten by real team names as results come
// in. Columns = rounds (left→right, final on the right); vertical position of
// each match = midpoint of the matches that feed it.
// ==============================================================================

// ── Pure helpers (exported for testing) ──────────────────────────────────────

const norm = (s) => (s || "").trim().toLowerCase();

// Parses "Winner of Semifinal 1" / "Loser of Quarterfinal 2" → "Semifinal 1".
// Returns null for a real team name or a group placeholder ("1st - Group A").
export function parseFeederRef(name) {
  const m = /^(?:winner|loser)\s+of\s+(.+)$/i.exec((name || "").trim());
  return m ? m[1].trim() : null;
}

// Strips a trailing index ("Semifinal 1" → "Semifinal", "Quarterfinal" → same)
// and any "WB " prefix, to derive the column's display label.
export function labelBase(title) {
  let t = (title || "").trim()
    .replace(/^WB\s+/i, "")               // "WB Quarterfinal 2" → "Quarterfinal 2"
    .replace(/\s*-\s*Match\s+\d+$/i, ""); // "LB Round 2 - Match 1" → "LB Round 2"
  // "Round of 16 3" → "Round of 16" (drop the trailing match index, keep the "16")
  const ro = /^(Round of \d+)(?:\s+\d+)?$/i.exec(t);
  if (ro) return ro[1];
  // Keep round-number labels intact ("Round 2", "LB Round 2" — the number matters).
  if (/^(LB\s+)?Round\s+\d+$/i.test(t)) return t;
  // "Semifinal 1" / "Quarterfinal 2" → strip the trailing match index.
  return t.replace(/\s+\d+$/, "").trim();
}

// "Rounds remaining until the final" for the standard named knockout rounds.
// Used only as a fallback when the Winner-of links have been overwritten.
function labelRemaining(title) {
  const t = norm(title);
  if (/grand final|conference championship|3rd place|^final\b|\bfinal\b/.test(t)) return 0;
  if (/sem?ifinal/.test(t)) return 1;
  if (/quarterfinal/.test(t)) return 2;
  if (/round of 16/.test(t)) return 3;
  if (/round of 32/.test(t)) return 4;
  const r = /round\s+(\d+)/.exec(t);
  if (r) return 100 - Number(r[1]); // earlier "Round N" → larger remaining
  return 50;
}

// Section a match belongs to within a sport+league bracket.
export function bracketSection(m) {
  const t = (m.match_title || "").trim();
  if (/^LB\b/i.test(t)) return "Losers Bracket";
  return "Winners Bracket";
}

// Given the bracket matches of ONE section, assign each a `round` (0 = earliest,
// leftmost) and a `slot` (vertical order). Returns { matches, feedersOf, rounds }.
export function layoutSection(sectionMatches) {
  const byTitle = new Map();
  sectionMatches.forEach((m) => byTitle.set(norm(m.match_title), m));

  const feedersOf = (m) =>
    [m.team_a_name, m.team_b_name]
      .map(parseFeederRef)
      .map((ref) => (ref ? byTitle.get(norm(ref)) : null))
      .filter(Boolean);

  const anyLinks = sectionMatches.some((m) => feedersOf(m).length > 0);

  // Column (round) assignment.
  if (anyLinks) {
    const memo = new Map();
    const depth = (m, seen) => {
      if (memo.has(m)) return memo.get(m);
      if (seen.has(m)) return 0; // cycle guard
      seen.add(m);
      const f = feedersOf(m);
      const d = f.length ? 1 + Math.max(...f.map((x) => depth(x, seen))) : 0;
      seen.delete(m);
      memo.set(m, d);
      return d;
    };
    sectionMatches.forEach((m) => { m.__round = depth(m, new Set()); });
  } else {
    const rem = sectionMatches.map((m) => labelRemaining(m.match_title));
    const maxRem = Math.max(...rem);
    sectionMatches.forEach((m, i) => { m.__round = maxRem - rem[i]; });
  }

  // Vertical slots via DFS from the roots (matches no one feeds from), so
  // sibling feeders sit adjacent and internal nodes land at their midpoint.
  const referenced = new Set();
  sectionMatches.forEach((m) => feedersOf(m).forEach((f) => referenced.add(f)));
  const roots = sectionMatches
    .filter((m) => !referenced.has(m))
    .sort((a, b) => b.__round - a.__round);

  let slot = 0;
  const placed = new Set();
  const place = (m) => {
    if (placed.has(m)) return;
    placed.add(m);
    const f = feedersOf(m).slice().sort((a, b) => a.__round - b.__round);
    if (f.length === 0) {
      m.__slot = slot++;
    } else {
      f.forEach(place);
      const ys = f.map((x) => x.__slot);
      m.__slot = ys.reduce((s, y) => s + y, 0) / ys.length;
    }
  };
  roots.forEach(place);
  // Any match not reached (disconnected/edited) gets stacked at the end.
  sectionMatches.forEach((m) => { if (!placed.has(m)) { place(m); } });

  const maxRound = Math.max(0, ...sectionMatches.map((m) => m.__round));
  return { matches: sectionMatches, feedersOf, maxRound };
}

// Header label for a column, e.g. "Final" / "Semifinals" / "Round of 16".
function columnLabel(matches, round, maxRound, section) {
  // Prefer the actual generated label when the column is consistent.
  const bases = [...new Set(matches.map((m) => labelBase(m.match_title)))];
  if (bases.length === 1 && bases[0]) {
    const b = bases[0];
    if (/^(final|grand final|conference championship)$/i.test(b)) return b;
    if (/^semi?final$/i.test(b)) return "Semifinals";
    if (/^quarterfinal$/i.test(b)) return "Quarterfinals";
    return b; // "Round of 16", "Round 2", "LB Round 1", "3rd Place Playoff"…
  }
  // Mixed column → derive from distance to the final.
  const dist = maxRound - round;
  if (section === "Losers Bracket") return `Losers Round ${round + 1}`;
  return ["Final", "Semifinals", "Quarterfinals", "Round of 16", "Round of 32"][dist] || `Round ${round + 1}`;
}

// Computes a round-robin standings table directly from the matches drawn on a
// pool page, so the table always agrees with the fixtures shown. Ranking uses
// the universal win/draw/loss = 3/1/0 then goal/point difference — a visual
// summary, not the authoritative standings page (which honours per-sport rules).
export function computeStandings(poolMatches, pts = { win: 3, draw: 1, loss: 0 }) {
  const tbl = new Map();
  const ensure = (id, name) => {
    const key = id || `name:${name}`;
    if (!tbl.has(key)) tbl.set(key, { id: id || null, name: name || "—", P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, Pts: 0 });
    return tbl.get(key);
  };
  // Register every participant first (so unplayed teams still appear at 0).
  poolMatches.forEach((m) => {
    if (m.team_a_id || m.team_a_name) ensure(m.team_a_id, m.team_a_name);
    if (m.team_b_id || m.team_b_name) ensure(m.team_b_id, m.team_b_name);
  });
  poolMatches.forEach((m) => {
    if ((m.status || "").toLowerCase() !== "finished") return;
    const a = ensure(m.team_a_id, m.team_a_name);
    const b = ensure(m.team_b_id, m.team_b_name);
    const sa = Number(m.team_a_score) || 0, sb = Number(m.team_b_score) || 0;
    a.P++; b.P++; a.GF += sa; a.GA += sb; b.GF += sb; b.GA += sa;
    if (sa > sb) { a.W++; b.L++; a.Pts += pts.win; b.Pts += pts.loss; }
    else if (sb > sa) { b.W++; a.L++; b.Pts += pts.win; a.Pts += pts.loss; }
    else { a.D++; b.D++; a.Pts += pts.draw; b.Pts += pts.draw; }
  });
  return [...tbl.values()].sort(
    (x, y) => y.Pts - x.Pts || (y.GF - y.GA) - (x.GF - x.GA) || y.GF - x.GF || x.name.localeCompare(y.name)
  );
}

// ── Logo loading (best-effort) ───────────────────────────────────────────────

function makeLogoLoader() {
  const cache = new Map();
  return (url) => {
    if (!url) return Promise.resolve(null);
    if (cache.has(url)) return cache.get(url);
    const p = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const size = 64;
          const canvas = document.createElement("canvas");
          canvas.width = size; canvas.height = size;
          const ctx = canvas.getContext("2d");
          // contain the logo in a square, transparent padding
          const scale = Math.min(size / img.width, size / img.height);
          const w = img.width * scale, h = img.height * scale;
          ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
          resolve(canvas.toDataURL("image/png"));
        } catch {
          resolve(null); // tainted canvas (no CORS headers) → fall back to initials
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
    cache.set(url, p);
    return p;
  };
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Generates and downloads the fixture chart PDF.
 *
 * @param {Object}   o
 * @param {Array}    o.matches            full match list (already loaded)
 * @param {Array}    o.sports             [{ id, sport_name, gender, standings_type }]
 * @param {Function} o.getLeaguesForSport (sportId) => string[]
 * @param {Object}   o.teamsById          { [id]: { name, logo_url, country } }
 * @param {string}   o.eventName
 * @param {string}   [o.eventLogoUrl]
 */
export async function exportFixtureChartPdf(o) {
  const { matches, sports, getLeaguesForSport, teamsById = {}, eventName = "", eventLogoUrl = "" } = o;
  const { jsPDF } = await import("jspdf");
  const loadLogo = makeLogoLoader();

  // Colors
  const DARK = [15, 23, 42];
  const GOLD = [223, 197, 139];
  const SLATE = [100, 116, 139];
  const BORDER = [203, 213, 225];
  const WIN = [16, 185, 129];
  const LINE = [120, 130, 150]; // connector lines / arrows

  // A palette for the initials-circle fallback (deterministic per team name).
  const AVATARS = [
    [99, 102, 241], [16, 185, 129], [244, 114, 182], [251, 146, 60],
    [56, 189, 248], [168, 85, 247], [234, 179, 8], [248, 113, 113],
  ];

  // Geometry (mm) — sized for legibility, with wide boxes for long team names.
  const M = 14;              // page margin
  const BOX_W = 90;          // match box width (fits longer names)
  const ROW_H = 15;          // one team row
  const BOX_H = ROW_H * 2;   // a match = two rows
  const V_GAP = 11;          // vertical gap between match boxes
  const H_GAP = 30;          // horizontal gap between rounds (room for arrows)
  const HEADER_TOP = 46;     // space for the title band + round headers
  const COL_PITCH = BOX_W + H_GAP;
  const SLOT_PITCH = BOX_H + V_GAP;
  const LOGO = ROW_H - 3;    // logo square (mm) — larger, more present

  // logo data URLs needed (winners/losers brackets + pools)
  const logoUrls = new Set();
  matches.forEach((m) => {
    [m.team_a_id, m.team_b_id].forEach((id) => {
      const u = teamsById[id]?.logo_url;
      if (u) logoUrls.add(u);
    });
  });
  const logoMap = new Map();
  await Promise.all([...logoUrls].map(async (u) => { logoMap.set(u, await loadLogo(u)); }));
  const eventLogo = eventLogoUrl ? await loadLogo(eventLogoUrl) : null;

  const trunc = (doc, text, maxW) => {
    let t = String(text ?? "");
    if (doc.getTextWidth(t) <= maxW) return t;
    while (t.length > 1 && doc.getTextWidth(t + "…") > maxW) t = t.slice(0, -1);
    return t + "…";
  };

  let doc = null;
  let pageCount = 0;

  // Draws the dark title band + round headers on the current page.
  const drawHeader = (sportLabel, groupLabel, columnHeaders, pageW) => {
    const BAND = 30;
    doc.setFillColor(...DARK);
    doc.rect(0, 0, pageW, BAND, "F");
    if (eventLogo) { try { doc.addImage(eventLogo, "PNG", M, 6, 18, 18); } catch {} }
    const textX = eventLogo ? M + 23 : M;
    doc.setTextColor(...GOLD);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(eventName.toUpperCase(), textX, 11);
    doc.setFontSize(19);
    doc.setTextColor(255, 255, 255);
    doc.text(`${sportLabel}${groupLabel ? `   —   ${groupLabel}` : ""}`, textX, 22);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(148, 163, 184);
    doc.text("FIXTURE CHART", textX, 28);

    // Round headers — pill above each column.
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    columnHeaders.forEach(({ label, x }) => {
      const cx = x + BOX_W / 2;
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(...BORDER);
      doc.roundedRect(x + 4, BAND + 5, BOX_W - 8, 9, 2, 2, "FD");
      doc.setTextColor(...DARK);
      doc.text(label.toUpperCase(), cx, BAND + 11, { align: "center" });
    });
  };

  // Initials from a team name, e.g. "Abu Dhabi University" → "AD", "25" → "25".
  const initials = (name) => {
    const t = (name || "").trim();
    if (!t) return "?";
    if (/^\d+$/.test(t)) return t.slice(0, 3);
    const words = t.split(/\s+/).filter(Boolean);
    return ((words[0]?.[0] || "") + (words[1]?.[0] || "")).toUpperCase() || t.slice(0, 2).toUpperCase();
  };
  const avatarColor = (name) => {
    let h = 0;
    for (const c of name || "") h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return AVATARS[h % AVATARS.length];
  };

  // Draws a single match box at (x, y) and returns connector anchor points.
  const drawMatch = (m, x, y) => {
    const rows = [
      { name: m.team_a_name, id: m.team_a_id, score: m.team_a_score },
      { name: m.team_b_name, id: m.team_b_id, score: m.team_b_score },
    ];
    const finished = (m.status || "").toLowerCase() === "finished";
    const sA = Number(m.team_a_score), sB = Number(m.team_b_score);

    // outer card
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.5);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, BOX_W, BOX_H, 1.5, 1.5, "FD");

    rows.forEach((r, i) => {
      const ry = y + i * ROW_H;
      const isWinner = finished && ((i === 0 && sA > sB) || (i === 1 && sB > sA));
      if (isWinner) {
        doc.setFillColor(236, 253, 245);
        doc.rect(x + 0.5, ry + (i === 0 ? 0.5 : 0), BOX_W - 1, ROW_H - (i === 0 ? 0.5 : 0.5), "F");
      }

      // logo or initials avatar
      const lx = x + 2.5, ly = ry + (ROW_H - LOGO) / 2;
      const u = teamsById[r.id]?.logo_url;
      const data = u ? logoMap.get(u) : null;
      if (data) {
        try { doc.addImage(data, "PNG", lx, ly, LOGO, LOGO); }
        catch { drawAvatar(r.name, lx, ly); }
      } else if (r.id) {
        drawAvatar(r.name, lx, ly);
      } // null id (TBA placeholder) → no avatar
      const tx = lx + LOGO + 2.5;

      // name
      doc.setFont("helvetica", isWinner ? "bold" : "normal");
      doc.setFontSize(11.5);
      doc.setTextColor(...(r.id ? DARK : SLATE));
      const scoreW = finished ? 12 : 0;
      doc.text(trunc(doc, r.name || "TBA", BOX_W - (tx - x) - scoreW - 3), tx, ry + ROW_H / 2 + 1.5);

      // score
      if (finished) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...(isWinner ? WIN : SLATE));
        doc.text(String(r.score ?? "0"), x + BOX_W - 3, ry + ROW_H / 2 + 1.4, { align: "right" });
      }
    });

    // divider between the two rows
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.4);
    doc.line(x, y + ROW_H, x + BOX_W, y + ROW_H);

    return { left: { x, y: y + BOX_H / 2 }, right: { x: x + BOX_W, y: y + BOX_H / 2 } };
  };

  // Colored circle + initials, used when a team has no usable logo.
  function drawAvatar(name, lx, ly) {
    const [r, g, b] = avatarColor(name);
    doc.setFillColor(r, g, b);
    doc.circle(lx + LOGO / 2, ly + LOGO / 2, LOGO / 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(LOGO * 2);
    doc.setTextColor(255, 255, 255);
    doc.text(initials(name), lx + LOGO / 2, ly + LOGO / 2 + LOGO * 0.28, { align: "center" });
  }

  // Draws an elbow connector with an arrowhead, feeder.right → match.left.
  const drawConnector = (from, to) => {
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.6);
    const midX = (from.x + to.x) / 2;
    doc.line(from.x, from.y, midX, from.y);
    doc.line(midX, from.y, midX, to.y);
    doc.line(midX, to.y, to.x - 2.2, to.y);
    // arrowhead at the destination
    doc.setFillColor(...LINE);
    doc.triangle(to.x, to.y, to.x - 2.6, to.y - 1.6, to.x - 2.6, to.y + 1.6, "F");
  };

  // Renders one bracket page for a (sport, league) combination.
  const renderBracketPage = (sportLabel, groupLabel, bracketMatches) => {
    // Split into sections (winners / losers) and lay each out.
    const sectionNames = [...new Set(bracketMatches.map(bracketSection))];
    const sections = sectionNames.map((name) => {
      const sm = bracketMatches.filter((m) => bracketSection(m) === name);
      return { name, ...layoutSection(sm) };
    });

    // Page dimensions from the widest / tallest section.
    const maxCols = Math.max(...sections.map((s) => s.maxRound + 1));
    const sectionHeight = (s) => {
      const slots = Math.max(1, Math.ceil(Math.max(...s.matches.map((m) => m.__slot)) + 1));
      return slots * SLOT_PITCH + 10; // + section title
    };
    const totalH = sections.reduce((h, s) => h + sectionHeight(s), 0);
    const pageW = Math.max(297, M * 2 + maxCols * COL_PITCH - H_GAP);
    const pageH = Math.max(210, HEADER_TOP + totalH + M);

    if (!doc) doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [pageW, pageH] });
    else doc.addPage([pageW, pageH], "landscape");
    pageCount++;

    const columnHeaders = [];
    for (let r = 0; r < maxCols; r++) {
      const colMatches = sections.flatMap((s) => s.matches.filter((m) => m.__round === r));
      if (!colMatches.length) continue;
      const x = M + r * COL_PITCH;
      const sec = sections.find((s) => s.matches.some((m) => m.__round === r));
      columnHeaders.push({ label: columnLabel(colMatches, r, maxCols - 1, sec?.name), x });
    }
    drawHeader(sportLabel, groupLabel, columnHeaders, pageW);

    let yOffset = HEADER_TOP;
    sections.forEach((s) => {
      if (sections.length > 1) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(...GOLD);
        doc.text(s.name.toUpperCase(), M, yOffset + 2);
        yOffset += 6;
      }
      const anchors = new Map();
      // draw boxes
      s.matches.forEach((m) => {
        const x = M + m.__round * COL_PITCH;
        const y = yOffset + m.__slot * SLOT_PITCH;
        anchors.set(m, drawMatch(m, x, y));
      });
      // draw connectors (feeder.right → match.left)
      s.matches.forEach((m) => {
        const a = anchors.get(m);
        s.feedersOf(m).forEach((f) => {
          const fa = anchors.get(f);
          if (fa && a) drawConnector(fa.right, a.left);
        });
      });
      yOffset += sectionHeight(s);
    });

    // footer
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("APEX SPORTS ACADEMY", M, pageH - 5);
  };

  // Standings panel geometry.
  const STAND_W = 96;
  const ST_ROW = 12;

  // Draws the panel the league rounds flow into. Before any result is entered
  // it's a clean PARTICIPANTS list (rank + team); once results exist it becomes
  // the full STANDINGS table (played + points) with the leader marked champion.
  const drawStandings = (table, x, yTop, hasResults) => {
    const h = table.length * ST_ROW + 4;
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.5);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, yTop, STAND_W, h, 2, 2, "FD");

    table.forEach((t, i) => {
      const ry = yTop + 2 + i * ST_ROW;
      const isLeader = hasResults && i === 0;
      if (isLeader) {
        doc.setFillColor(254, 249, 231); // soft gold
        doc.roundedRect(x + 1, ry, STAND_W - 2, ST_ROW, 1.5, 1.5, "F");
      }
      // rank
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...(isLeader ? GOLD : SLATE));
      doc.text(String(i + 1), x + 5, ry + ST_ROW / 2 + 1.4, { align: "center" });
      // logo / avatar
      const lx = x + 9, ly = ry + (ST_ROW - LOGO) / 2;
      const u = teamsById[t.id]?.logo_url;
      const data = u ? logoMap.get(u) : null;
      if (data) { try { doc.addImage(data, "PNG", lx, ly, LOGO, LOGO); } catch { drawAvatar(t.name, lx, ly); } }
      else { drawAvatar(t.name, lx, ly); }
      // name (wider when there are no points columns to show)
      doc.setFont("helvetica", isLeader ? "bold" : "normal");
      doc.setFontSize(11);
      doc.setTextColor(...DARK);
      const nameRight = hasResults ? 24 : 4;
      doc.text(trunc(doc, t.name, STAND_W - (lx + LOGO + 2.5 - x) - nameRight), lx + LOGO + 2.5, ry + ST_ROW / 2 + 1.4);
      // played + points — only once results exist
      if (hasResults) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(...SLATE);
        doc.text(`P${t.P}`, x + STAND_W - 22, ry + ST_ROW / 2 + 1.4, { align: "right" });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...(isLeader ? WIN : DARK));
        doc.text(`${t.Pts}`, x + STAND_W - 4, ry + ST_ROW / 2 + 1.4, { align: "right" });
      }
    });
    return { x, yTop, h };
  };

  // Renders a pool / league / round-robin page: rounds as columns flowing
  // (with arrows) into a final STANDINGS panel.
  const renderPoolPage = (sportLabel, groupLabel, poolMatches) => {
    // Group by round label (e.g. "Round 1") parsed from the title's tail.
    const roundOf = (m) => {
      const r = /round\s+(\d+)/i.exec(m.match_title || "");
      return r ? Number(r[1]) : 1;
    };
    const rounds = [...new Set(poolMatches.map(roundOf))].sort((a, b) => a - b);
    const byRound = rounds.map((r) => ({ r, items: poolMatches.filter((m) => roundOf(m) === r) }));
    const maxRows = Math.max(...byRound.map((g) => g.items.length));
    const table = computeStandings(poolMatches);
    const hasResults = table.some((t) => t.P > 0);

    const standX = M + rounds.length * COL_PITCH;
    const matchesH = maxRows * SLOT_PITCH;
    const standH = table.length * ST_ROW + 4;
    const pageW = standX + STAND_W + M;
    const pageH = Math.max(210, HEADER_TOP + Math.max(matchesH, standH) + M);

    if (!doc) doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [pageW, pageH] });
    else doc.addPage([pageW, pageH], "landscape");
    pageCount++;

    const columnHeaders = [
      ...byRound.map((g, i) => ({ label: `Round ${g.r}`, x: M + i * COL_PITCH })),
      { label: hasResults ? "Standings" : "Participants", x: standX },
    ];
    drawHeader(sportLabel, groupLabel, columnHeaders, pageW);

    // Round columns; remember the last round's anchors for the flow arrows.
    let lastAnchors = [];
    byRound.forEach((g, i) => {
      const x = M + i * COL_PITCH;
      const anchors = g.items.map((m, j) => drawMatch(m, x, HEADER_TOP + j * SLOT_PITCH));
      if (i === byRound.length - 1) lastAnchors = anchors;
    });

    // Standings panel + converging arrows from the final round into it.
    const panel = drawStandings(table, standX, HEADER_TOP, hasResults);
    const target = { x: panel.x, y: panel.yTop + panel.h / 2 };
    lastAnchors.forEach((a) => drawConnector(a.right, target));

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text("APEX SPORTS ACADEMY", M, pageH - 5);
  };

  // ── Iterate sports → leagues ────────────────────────────────────────────────
  const isBracket = (m) => ["knockout", "playoff", "final"].includes(m.stage);

  sports.forEach((sport) => {
    const sportMatches = matches.filter((m) => m.sport_id === sport.id);
    if (!sportMatches.length) return;
    const sportLabel = `${sport.sport_name}${sport.gender ? ` (${sport.gender})` : ""}`;

    const leagues = getLeaguesForSport(sport.id).filter((l) => sportMatches.some((m) => m.league_name === l));
    const leagueless = sportMatches.filter((m) => !m.league_name?.trim());
    const groups = [
      ...leagues.map((l) => ({ label: l, items: sportMatches.filter((m) => m.league_name === l) })),
      ...(leagueless.length ? [{ label: null, items: leagueless }] : []),
    ];

    groups.forEach(({ label, items }) => {
      const bracket = items.filter(isBracket);
      const pool = items.filter((m) => !isBracket(m));
      // Within a league there may be several round-robin GROUPS ("Group A - Round 1").
      // Render each group's pool, then the knockout bracket.
      if (pool.length) {
        const groupName = (m) => {
          const g = /^(.*?)\s*-\s*round\s+\d+/i.exec(m.match_title || "");
          return g ? g[1].trim() : null;
        };
        const subGroups = [...new Set(pool.map(groupName))];
        if (subGroups.length > 1 || subGroups[0]) {
          subGroups.forEach((sg) => {
            const sgItems = pool.filter((m) => groupName(m) === sg);
            renderPoolPage(sportLabel, [label, sg].filter(Boolean).join(" · "), sgItems);
          });
        } else {
          renderPoolPage(sportLabel, label, pool);
        }
      }
      if (bracket.length) renderBracketPage(sportLabel, label, bracket);
    });
  });

  if (!doc || pageCount === 0) {
    throw new Error("No fixtures available to chart.");
  }

  const today = new Date().toISOString().split("T")[0];
  doc.save(`Fixture_Chart_${today}.pdf`);
  return pageCount;
}
