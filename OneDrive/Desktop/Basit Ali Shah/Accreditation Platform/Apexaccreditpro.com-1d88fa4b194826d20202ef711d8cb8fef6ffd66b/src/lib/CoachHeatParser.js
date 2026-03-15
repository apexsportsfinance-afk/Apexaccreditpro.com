import jaroWinkler from 'jaro-winkler';

let pdfjsLib = null;

async function getPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  return pdfjsLib;
}

/**
 * Parses a HYTEK Meet Manager Heat Sheet or Event Results PDF.
 * Implements Smart 2-Column Detection and Automatic "LastName, FirstName" flipping.
 * Returns an array of matrix objects.
 */
export async function parseCompetitionPdf(file, type = 'heat_sheet') {
  const pdfjs = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;

  let allItems = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Calculate page mid-point dynamically by finding duplicate "Event" headers on the same Y-axis
    let leftEventX = null;
    let rightEventX = null;
    
    const pageItems = textContent.items
      .filter(i => "str" in i && i.str.trim())
      .map(i => ({
        str: i.str.trim(),
        x: i.transform[4],
        y: i.transform[5],
        page: pageNum
      }));

    // Attempt to find the column split (usually around X=300, but varies)
    const eventItems = pageItems.filter(i => /Event\s+\d+/i.test(i.str) || /Heat\s+\d+/i.test(i.str));
    for (let i = 0; i < eventItems.length; i++) {
      for (let j = i + 1; j < eventItems.length; j++) {
        if (Math.abs(eventItems[i].y - eventItems[j].y) < 5) {
          // Found two headers on the same line (left and right columns)
          leftEventX = Math.min(eventItems[i].x, eventItems[j].x);
          rightEventX = Math.max(eventItems[i].x, eventItems[j].x);
          break;
        }
      }
      if (leftEventX) break;
    }
    
    // Default split is exactly halfway between left and right headers, or X=300 fallback
    const dynamicSplitX = (leftEventX && rightEventX) ? ((leftEventX + rightEventX) / 2) : 300;

    // Assign column based on dynamic split
    pageItems.forEach(i => {
      i.col = i.x >= dynamicSplitX ? 1 : 0;
    });
    
    allItems = allItems.concat(pageItems);
  }

  const results = [];
  let currentEventCode = null;
  let currentEventName = null;
  let currentHeat = null;
  
  // Track column bounds for each column individually to handle multi-column pages
  const columnStates = [
    { headersFound: false, bounds: { lane: null, name: null, age: null, team: null, time: null, rank: null, seedTime: null } },
    { headersFound: false, bounds: { lane: null, name: null, age: null, team: null, time: null, rank: null, seedTime: null } }
  ];

  const eventRegex = /(?:Event\s+)(\d+[A-Z]?\.?\d*)\s+([A-Z].+)/i;
  const heatRegex = /(?:Heat|#|Flight|Group)\s*(\d+)/i;

  // Sorting for Two-Column Support
  allItems.sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    if (a.col !== b.col) return a.col - b.col;
    if (Math.abs(b.y - a.y) > 3) return b.y - a.y; 
    return a.x - b.x;
  });

  // Group into lines by Page, Column, and Y coordinate
  let lines = [];
  let currentLine = [];
  let currentY = null;
  let currentPage = null;
  let currentCol = null;

  for (const item of allItems) {
    const samePage = currentPage === item.page;
    const sameCol = currentCol === item.col;
    const sameY = currentY !== null && Math.abs(currentY - item.y) <= 3;

    if (!samePage || !sameCol || !sameY) {
      if (currentLine.length > 0) lines.push(currentLine);
      currentLine = [item];
      currentY = item.y;
      currentPage = item.page;
      currentCol = item.col;
    } else {
      currentLine.push(item);
    }
  }
  if (currentLine.length > 0) lines.push(currentLine);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fullText = line.map(c => c.str).join(" ");
    const colIdx = line[0].col || 0;
    const state = columnStates[colIdx];
    
    // 1. Check for Event start (Relaxed regex + handle multi-line)
    let eventMatch = fullText.match(eventRegex);
    if (!eventMatch) {
       // Lookback or lookahead for numeric prefix if "Event" is missing but name looks like an event
       const altMatch = fullText.match(/^(\d+[A-Z]?\.?\d*)\s+([A-Z].*(?:Men|Women|Boys|Girls|Mixed).*)/i);
       if (altMatch) eventMatch = altMatch;
    }
    
    if (eventMatch) {
      currentEventCode = eventMatch[1];
      currentEventName = eventMatch[2].trim();
      
      // Look at the NEXT line if it looks like a continuation of the event name
      if (i + 1 < lines.length) {
        const nextLine = lines[i+1];
        const nextText = nextLine.map(c => c.str).join(" ");
        if (nextText.length > 5 && !nextText.match(eventRegex) && !nextText.match(heatRegex) && !nextText.toLowerCase().includes('lane')) {
          currentEventName += " " + nextText;
          i++; // Skip next line
        }
      }

      currentHeat = null;
      // Reset bounds for BOTH columns when a new event starts
      columnStates.forEach(s => {
        s.headersFound = false;
        s.bounds = { lane: null, name: null, age: null, team: null, time: null, rank: null, seedTime: null };
      });
      continue;
    }

    if (!currentEventCode) continue;

    // 2. Check for Heat header
    if (type === 'heat_sheet') {
      const heatMatch = fullText.match(heatRegex);
      if (heatMatch) {
        currentHeat = parseInt(heatMatch[1], 10);
        // Do NOT reset bounds here; they should persist across heats of the same event
        continue;
      }
    }

    // 3. Header Detection (Lane, Name, Team...)
    const hasLane = line.find(c => c.str.toLowerCase() === 'lane'); // Strict exact match for header
    const hasName = line.find(c => c.str.toLowerCase() === 'name');

    if (hasLane || hasName || (type === 'event_result' && line.find(c => c.str.toLowerCase() === 'rank'))) {
      line.forEach(c => {
        const txt = c.str.toLowerCase();
        if (txt === 'lane') state.bounds.lane = { x: c.x };
        if (txt === 'name') state.bounds.name = { x: c.x };
        if (txt === 'age') state.bounds.age = { x: c.x };
        if (txt === 'team' || txt === 'club') state.bounds.team = { x: c.x };
        if (txt === 'rank') state.bounds.rank = { x: c.x };
        if (txt === 'seed') state.bounds.seedTime = { x: c.x };
        if (txt === 'final' || txt === 'result' || (txt.includes('time') && !txt.includes('seed'))) {
           if (!state.bounds.time) state.bounds.time = { x: c.x };
        }
      });
      state.headersFound = true;
      continue;
    }

    // 4. Extraction Logic
    if (currentEventCode && (currentHeat || type === 'event_result')) {
      let laneVal = null, rankVal = null, ageVal = null, nameVal = "", teamVal = "", seedVal = "", timeVal = "";

      // Smart adaptive bounds
      const activeBounds = { ...state.bounds };
      if (!state.headersFound) {
        // Find typical lane numbers at the start of the line
        const firstItem = line[0];
        if (firstItem && /^\d+$/.test(firstItem.str)) {
           const num = parseInt(firstItem.str, 10);
           if (num >= 0 && num <= 10) {
              // This is likely a lane number. If we don't have bounds, estimate them relative to this X
              const baseX = firstItem.x;
              activeBounds.lane = { x: baseX };
              activeBounds.name = activeBounds.name || { x: baseX + 35 };
              activeBounds.age = activeBounds.age || { x: baseX + 130 };
              activeBounds.team = activeBounds.team || { x: baseX + 160 };
           }
        }

        // Final fallback if still nothing
        if (!activeBounds.lane) {
          const baseX = colIdx === 1 ? 300 : 30;
          activeBounds.lane = { x: baseX + 10 };
          activeBounds.name = activeBounds.name || { x: baseX + 35 };
          activeBounds.age = activeBounds.age || { x: baseX + 160 };
          activeBounds.team = activeBounds.team || { x: baseX + 200 };
        }
      }

      for (const item of line) {
        const x = item.x;
        const txt = item.str;

        // Lane/Rank (Leftmost)
        if (activeBounds.name && x < activeBounds.name.x - 12) {
          if (/^\d+$/.test(txt)) {
            const val = parseInt(txt, 10);
            if (type === 'heat_sheet') {
               if (val >= 0 && val <= 10) laneVal = val;
            } else {
               rankVal = val;
            }
          }
        }
        // Name (Middle-Left)
        else if (activeBounds.name && x >= activeBounds.name.x - 20 && (!activeBounds.age || x < activeBounds.age.x - 5)) {
           nameVal += (nameVal ? " " : "") + txt;
        }
        // Age (Middle)
        else if (activeBounds.age && Math.abs(x - activeBounds.age.x) < 25 && /^\d+$/.test(txt)) {
          const val = parseInt(txt, 10);
          if (val > 0 && val < 110) ageVal = val;
        }
        // Team (Middle-Right)
        else if (activeBounds.team && x >= activeBounds.team.x - 15 && (!activeBounds.seedTime || x < activeBounds.seedTime.x - 5) && (!activeBounds.time || x < activeBounds.time.x - 5)) {
           teamVal += (teamVal ? " " : "") + txt;
        }
        // Seed Time
        else if (activeBounds.seedTime && Math.abs(x - activeBounds.seedTime.x) < 40) {
           seedVal = txt;
        }
        // Final Time (Rightmost)
        else if (activeBounds.time && Math.abs(x - activeBounds.time.x) < 40) {
           timeVal = txt;
        }
      }

      const cleanName = nameVal.trim();
      if (!cleanName || cleanName.toLowerCase() === 'empty' || cleanName === '---' || cleanName.length < 3) {
        continue;
      }

      let formattedName = cleanName;
      if (formattedName.includes(',')) {
        const parts = formattedName.split(',');
        if (parts.length === 2) {
          formattedName = `${parts[1].trim()} ${parts[0].trim()}`;
        }
      }

      if (laneVal || rankVal || /^\d+$/.test(line[0].str)) {
        results.push({
          eventCode: currentEventCode,
          eventName: currentEventName,
          heat: currentHeat || 1,
          lane: laneVal,
          athleteName: formattedName,
          age: ageVal,
          club: teamVal.trim(),
          seedTime: seedVal || null,
          rank: rankVal || (type === 'event_result' ? parseInt(line[0].str, 10) : null),
          resultTime: timeVal || null
        });
      }
    }
  }

  return results;
}

// Helpers for the matching recipe
function parseAgeCatFromEvent(eventName) {
  const match = eventName.match(/(\d+(?:\s*&\s*Over|\s*-\s*\d+)?)/i);
  return match ? match[1] : "Unknown";
}

function parseGenderFromEvent(eventName) {
  const lower = eventName.toLowerCase();
  if (lower.includes('girl') || lower.includes('women')) return 'F';
  if (lower.includes('boy') || lower.includes('men')) return 'M';
  return 'Mixed';
}

function normalizeTeam(teamStr) {
  return (teamStr || '').replace(/\s*\([A-Z]+\)$/i, '').trim().toLowerCase();
}

function normalizeName(name, stripMiddle = false) {
  let n = (name || '').trim().toLowerCase();
  if (stripMiddle) {
    const parts = n.split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0]} ${parts[parts.length - 1]}`;
    }
  }
  return n;
}

/**
 * Executes the matching cascade.
 * Includes Deduplication: An athlete can only match one lane per event/heat/round.
 */
export function matchAthleteEvents(parsedRows, accreditationRecords) {
  const matches = parsedRows.map(row => {
    const pdfName = row.athleteName;
    const pdfAge = row.age;
    const pdfTeam = row.club || "";
    const pdfEventCode = row.eventCode;
    const pdfEventName = row.eventName;
    const pdfHeat = row.heat;
    const pdfLane = row.lane || row.rank; 
    
    const pdfGender = parseGenderFromEvent(pdfEventName);
    const pdfAgeCat = parseAgeCatFromEvent(pdfEventName);
    const pdfRound = pdfEventName.toLowerCase().includes('final') ? 'Finals' : 'Prelims';

    let matched = false;
    let matchConfidence = 0.0;
    let matchLog = [];
    let accreditId = null;

    const normPdfName = pdfName.toLowerCase();
    const normPdfTeam = normalizeTeam(pdfTeam);

    // Filter accreditation records by gender/age if possible (Optimization)
    const relevantAccs = accreditationRecords.filter(acc => {
      // If we have gender in event name, filter by it
      if (pdfGender !== 'Mixed' && acc.gender) {
         if (acc.gender.charAt(0).toUpperCase() !== pdfGender) return false;
      }
      return true;
    });

    for (const acc of relevantAccs) {
      if (!acc.name || !acc.club_name) continue;

      const normAccName = normalizeName(acc.name);
      const normAccTeam = normalizeTeam(acc.club_name);
      
      const exactName = normAccName === normPdfName;
      const jwScore = jaroWinkler(normAccName, normPdfName);
      
      const pdfNameNoMiddle = normalizeName(pdfName, true);
      const accNameNoMiddle = normalizeName(acc.name, true);
      const fuzzyNameMatch = exactName || (pdfNameNoMiddle === accNameNoMiddle) || (jwScore >= 0.94);

      const exactAge = (pdfAge === null || pdfAge === undefined) ? true : Number(acc.age) === Number(pdfAge);
      const exactTeam = normAccTeam === normPdfTeam;
      const teamOverlaps = normAccTeam && normPdfTeam && (normAccTeam.includes(normPdfTeam) || normPdfTeam.includes(normAccTeam));
      
      // Cascade 1: Triple Match (Name + Age + Team) -> 1.0
      if (fuzzyNameMatch && exactAge && exactTeam) {
        matchConfidence = 1.0;
        matchLog = ["Strong Triple Match: Name, Age, and Club match."];
        accreditId = acc.id;
        matched = true;
        break;
      }

      // Cascade 2: Strong Name + Age + Partial Team -> 0.95
      if (fuzzyNameMatch && exactAge && teamOverlaps) {
        matchConfidence = 0.95;
        matchLog = ["High Confidence: Name and Age match. Club name overlaps."];
        accreditId = acc.id;
        matched = true;
        break;
      }

      // Cascade 3: Strong Name + Team Match (Age missing or slight mismatch) -> 0.90
      if (exactName && exactTeam) {
        matchConfidence = 0.90;
        matchLog = ["Accurate Match: Exact Name and Club match."];
        accreditId = acc.id;
        matched = true;
        break;
      }

      // Cascade 4: Jaro-Winkler Name Cross-Check -> 0.85
      if (jwScore >= 0.96 && exactAge) {
        matchConfidence = 0.85;
        matchLog = [`Fuzzy Match: Jaro-Winkler (${jwScore.toFixed(2)}) with age match.`];
        accreditId = acc.id;
        matched = true;
        break;
      }
    }

    return {
      accreditation_id: accreditId,
      pdf_name: pdfName,
      pdf_team: pdfTeam,
      event_code: pdfEventCode,
      event_name: pdfEventName,
      age_cat: pdfAgeCat,
      gender: pdfGender,
      heat: pdfHeat || 1,
      lane: pdfLane || 0,
      round: pdfRound,
      session_time: row.sessionTime || null,
      seed_time: row.seedTime,
      matched,
      match_confidence: matchConfidence,
      match_log: matchLog || ["No match found."]
    };
  });

  // --- DEDUPLICATION STEP ---
  // Ensure one registration per event/heat/round combination.
  // If Yassin Samir matches Lane 1 and Lane 6, we only keep the one with higher confidence.
  const deduplicated = [];
  const bestMatches = new Map(); // Key: accId_eventCode_heat_round

  matches.forEach(m => {
    if (!m.matched || !m.accreditation_id) {
      deduplicated.push(m);
      return;
    }

    const key = `${m.accreditation_id}_${m.event_code}_${m.heat}_${m.round}`;
    const existing = bestMatches.get(key);

    if (!existing || m.match_confidence > existing.match_confidence) {
      bestMatches.set(key, m);
    }
  });

  // Collect the best matches
  const uniqueAccMatches = Array.from(bestMatches.values());
  
  // Combine unique matches with unmatched rows
  const finalResult = [...uniqueAccMatches, ...matches.filter(m => !m.matched)];

  return finalResult;
}
