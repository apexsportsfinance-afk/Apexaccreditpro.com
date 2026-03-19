import jaroWinkler from 'jaro-winkler';
import * as XLSX from 'xlsx';

let pdfjsLib = null;

async function getPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  return pdfjsLib;
}

/**
 * Universal Parser for HYTEK Meet Manager Heat Sheets or Event Results.
 * Supports: PDF, HTML, XLSX, XLS, and CSV
 */
export async function parseCompetitionFile(file, type = 'heat_sheet') {
  const filename = file.name ? file.name.toLowerCase() : '';
  
  if (filename.endsWith('.pdf')) {
    return parseCompetitionPdf(file, type);
  } else if (filename.endsWith('.htm') || filename.endsWith('.html')) {
    return parseCompetitionHtml(file, type);
  } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls') || filename.endsWith('.csv')) {
    return parseCompetitionExcel(file, type);
  } else {
    console.warn("Unknown file extension, attempting PDF parser by default:", filename);
    try {
        return await parseCompetitionPdf(file, type);
    } catch (err) {
        throw new Error("Unsupported file format. Please upload a PDF, HTML, Excel, or CSV file.");
    }
  }
}

async function parseCompetitionExcel(file, type = 'heat_sheet') {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    // Parse into an array of arrays
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // PRE-PROCESSING: Expand rows with newline characters in cells (mashed Heat/Athlete cells)
    const rows = [];
    for (const row of rawRows) {
        if (!row || !row.length) continue;
        let maxLines = 1;
        for (const cell of row) {
            if (typeof cell === 'string') {
                const lines = cell.split(/\r?\n/);
                if (lines.length > maxLines) maxLines = lines.length;
            }
        }
        if (maxLines === 1) {
            rows.push(row);
        } else {
            for (let i = 0; i < maxLines; i++) {
                const newRow = row.map(cell => {
                    if (typeof cell === 'string') {
                        const lines = cell.split(/\r?\n/);
                        return lines[i] !== undefined ? lines[i] : "";
                    }
                    return i === 0 ? cell : "";
                });
                // Only push if the row actually has text
                if (newRow.join("").trim()) rows.push(newRow);
            }
        }
    }

    const results = [];
    let currentEventCode = null;
  let currentEventName = null;
  let currentHeat = null;
  let columnIndexes = { lane: -1, name: -1, age: -1, team: -1, seedTime: -1, finalTime: -1, place: -1 };

  const eventRegex = /(?:Event\s+)(\d+[A-Z]?\.?\d*)\s+([A-Z].+)/i;
  const heatRegex = /(?:Heat|#|Flight|Group)\s*(\d+)/i;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row.length) continue;
    const rowText = row.join(" ").replace(/\s+/g, ' ').trim();

    let eventMatch = rowText.match(eventRegex);
    if (!eventMatch) {
        for (const cell of row) {
            if (typeof cell !== 'string') continue;
            const m = cell.replace(/\s+/g, ' ').trim().match(eventRegex);
            if (m) { eventMatch = m; break; }
        }
    }

    if (eventMatch) {
      currentEventCode = eventMatch[1];
      currentEventName = eventMatch[2].trim();
      currentHeat = null;
      columnIndexes = { lane: -1, name: -1, age: -1, team: -1, seedTime: -1, finalTime: -1, place: -1 };
      continue;
    }

    if (!currentEventCode) continue;

    const heatMatch = rowText.match(heatRegex);
    if (heatMatch && row.some(c => typeof c === 'string' && c.toLowerCase().includes('heat'))) {
       currentHeat = parseInt(heatMatch[1], 10);
    }

    const lowerText = rowText.toLowerCase();
    if (lowerText.includes('lane') || lowerText.includes('name') || lowerText.includes('team')) {
      let foundHeaders = false;
      row.forEach((cell, index) => {
        if (typeof cell !== 'string') return;
        const txt = cell.trim().toLowerCase();
        if (txt === 'lane') { columnIndexes.lane = index; foundHeaders = true; }
        else if (txt === 'name') { columnIndexes.name = index; foundHeaders = true; }
        else if (txt === 'age') { columnIndexes.age = index; foundHeaders = true; }
        else if (txt === 'team' || txt === 'club') { columnIndexes.team = index; foundHeaders = true; }
        else if (txt.includes('seed')) { columnIndexes.seedTime = index; foundHeaders = true; }
        else if (txt.includes('final') || txt === 'result time') { columnIndexes.finalTime = index; foundHeaders = true; }
        else if (txt === 'place' || txt === 'rank') { columnIndexes.place = index; foundHeaders = true; }
      });
      if (foundHeaders) continue;
    }

    if (currentEventCode && columnIndexes.name !== -1) {
        const laneValRaw = row[columnIndexes.lane] || row[0];
        let laneVal = null;
        let isAthleteRow = false;

        if (laneValRaw !== undefined && laneValRaw !== null && /^\d+$/.test(String(laneValRaw).trim())) {
            laneVal = parseInt(String(laneValRaw).trim(), 10);
            isAthleteRow = true;
        }

        if (isAthleteRow) {
            const extractCell = (idx) => {
                const val = row[idx];
                return val !== undefined && val !== null ? String(val).replace(/\s+/g, ' ').trim() : "";
            };

            const rawName = extractCell(columnIndexes.name);
            const rawAge = extractCell(columnIndexes.age);
            const rawTeam = extractCell(columnIndexes.team);
            const rawSeed = extractCell(columnIndexes.seedTime);
            const rawFinal = extractCell(columnIndexes.finalTime);
            const rawPlace = extractCell(columnIndexes.place);

            if (rawName && rawName.length > 2) {
                let formattedName = rawName;
                if (formattedName.includes(',')) {
                    const parts = formattedName.split(',');
                    if (parts.length === 2) {
                        formattedName = `${parts[1].trim()} ${parts[0].trim()}`;
                    }
                }
                results.push({
                    eventCode: currentEventCode,
                    eventName: currentEventName,
                    heat: currentHeat || 1,
                    lane: laneVal,
                    athleteName: formattedName,
                    age: rawAge ? parseInt(rawAge, 10) : null,
                    club: rawTeam,
                    seedTime: rawSeed || null,
                    resultTime: rawFinal || null,
                    rank: rawPlace ? parseInt(rawPlace, 10) : null
                });
            }
        }
    }
  }
  console.log("[DEBUG] Excel output rows:", results.length);
  return results;
} catch (err) {
  console.error("FATAL EXCEL PARSER ERROR:", err);
  throw new Error(`Excel grid extraction failed: ${err.message}`);
}
}

async function parseCompetitionHtml(file, type = 'heat_sheet') {
  const htmlContent = await file.text();
  
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  
  const allRows = [];
  
  // Extract vertically maintaining structure
  const topLevels = doc.body.children;
  for (let i = 0; i < topLevels.length; i++) {
    const el = topLevels[i];
    if (el.tagName === 'P' || el.tagName === 'DIV') {
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text) allRows.push([text]);
    } else if (el.tagName === 'PRE') {
      const lines = (el.textContent || '').split('\n');
      lines.forEach(line => {
         const cleanLine = line.trim();
         if (cleanLine) {
             // Split the line by multiple spaces to form 'columns'
             const cells = cleanLine.split(/\s{2,}/);
             allRows.push(cells);
         }
      });
    } else if (el.tagName === 'TABLE') {
      const trs = el.querySelectorAll('tr');
      for (let j = 0; j < trs.length; j++) {
        const tr = trs[j];
        const tds = tr.querySelectorAll('td, th');
        if (!tds.length) continue;
        
        let maxP = 1;
        tds.forEach(td => {
            const pCount = td.querySelectorAll('p').length;
            if (pCount > maxP) maxP = pCount;
        });

        if (maxP <= 1) {
            const cells = Array.from(tds).map(td => (td.textContent || '').replace(/\s+/g, ' ').trim());
            if (cells.join("").trim()) allRows.push(cells);
        } else {
            for(let pIdx = 0; pIdx < maxP; pIdx++) {
                const cells = Array.from(tds).map(td => {
                    const ps = td.querySelectorAll('p');
                    if (ps.length > pIdx) return (ps[pIdx].textContent || '').replace(/\s+/g, ' ').trim();
                    else if (ps.length === 0 && pIdx === 0) return (td.textContent || '').replace(/\s+/g, ' ').trim();
                    return "";
                });
                if (cells.join("").trim()) allRows.push(cells);
            }
        }
      }
    }
  }


  
  const results = [];
  let currentEventCode = null;
  let currentEventName = null;
  let currentHeat = null;

  // Process rows sequentially to maintain Event/Heat state
  for (let i = 0; i < allRows.length; i++) {
    const cells = allRows[i].map(c => c.trim()).filter(c => c.length > 0);
    if (!cells || cells.length === 0) continue;

    const fullRowText = cells.join(" ").toLowerCase();

    // 1. Detect Event Header (e.g. "Event 101 Girls 12 & Over 1500 LC Meter Freestyle")
    // Do not trigger on Continuation Headers which wrap the event in parenthesis like "(Event 101"
    if (fullRowText.includes("event") && cells.some(c => (/event\s+\d+/i).test(c)) && !fullRowText.includes("(event")) {
        const eventStr = allRows[i].join(" "); // keep original casing
        const eventMatch = eventStr.match(/Event\s+(\d+)\s+(.+)/i);
        if (eventMatch) {
            currentEventCode = eventMatch[1].trim();
            currentEventName = eventMatch[2].trim();
            currentHeat = 1; // Reset heat on new event
        }
        continue;
    }

    // 2. Detect standalone Heat Header (e.g. "Heat" in cell 0, "2 of 2 Timed Finals" in cell 1)
    if (cells[0].match(/^heat\b/i) && !cells.some(c => /^\d{1,2}:\d{2}\.\d{2}/.test(c))) {
        // Find "Heat 2" or "Heat 1 of 2" anywhere in the row string
        let hMatch = cells.join(" ").match(/heat\s+(\d+)/i);
        if (!hMatch && cells[1] && cells[1].includes("of")) {
            hMatch = cells[1].match(/^(\d+)/);
        }
        if (hMatch) {
            currentHeat = parseInt(hMatch[1], 10);
        }
        continue;
    }

    // 3. Detect Athlete Row (Typically 4+ columns with Lane, Name, [Age], Team, Seed, Final)
    if (cells.length >= 4 && !fullRowText.includes('event') && !fullRowText.includes('lane')) {
        let laneVal = null;
        let rankVal = null;
        let nextHeat = null;
        
        let firstCell = cells[0].replace(/\D/g, ''); // strip out "Heat" words if they got mashed
        if (firstCell && /^\d+$/.test(firstCell)) {
            let num = parseInt(firstCell, 10);
            if (num > 0 && num <= 10) laneVal = num; // swim lanes are usually 1-10
            else rankVal = num;
        }

        let rawName = cells[1] || "";

        // Sometimes Heat is mashed into the Lane column ("6 Heat") with values ("2 of 2") in Name column
        if (cells[0].toLowerCase().includes("heat")) {
            const heatNumMatch = rawName.match(/(\d+)\s+of\s+\d+/i);
            if (heatNumMatch) {
               nextHeat = parseInt(heatNumMatch[1], 10);
               rawName = rawName.replace(/\d+\s+of\s+\d+.*?$/i, '').trim();
            } else {
               const cell0Match = cells[0].match(/heat\s+(\d+)/i);
               if (cell0Match) nextHeat = parseInt(cell0Match[1], 10);
            }
        }

        // Standard Meet Manager Columns
        let rawAge = cells[2];
        let rawTeam = cells[3];
        let rawSeed = cells[4];
        let rawFinal = (cells.length > 5) ? cells[5] : null;

        // Native <pre> tags often fail to provide 2 spaces between Age and Team (e.g., "11 Hamilton")
        // causing cells to merge and shift Seed/Final times out of alignment.
        if (rawAge && /[a-zA-Z]/.test(rawAge)) {
            const ageTeamMatch = rawAge.trim().match(/^(\d{1,2})\s+(.+)$/);
            if (ageTeamMatch) {
                rawAge = ageTeamMatch[1];
                rawTeam = ageTeamMatch[2]; // "Hamilton"
                rawFinal = rawSeed;        // Shift the 5th column value to the 6th
                rawSeed = cells[3];        // Shift the 4th column value to the 5th
            }
        }

        if (rawName && rawName.length > 2 && !rawName.toLowerCase().includes("name")) {
            let formattedName = rawName;
            if (formattedName.includes(',')) {
                const parts = formattedName.split(',');
                if (parts.length === 2) {
                    formattedName = `${parts[1].trim()} ${parts[0].trim()}`;
                }
            }

            let ageVal = rawAge ? rawAge.replace(/\D/g, '') : null;

            // Apply newly discovered heat for the current and subsequent rows
            if (nextHeat !== null) {
                currentHeat = nextHeat;
            }

            results.push({
                eventCode: currentEventCode,
                eventName: currentEventName,
                heat: currentHeat || 1, // Athlete is in the current heat
                lane: laneVal,
                athleteName: formattedName,
                age: ageVal ? parseInt(ageVal, 10) : null,
                club: rawTeam,
                seedTime: rawSeed && rawSeed.length > 3 ? rawSeed : null,
                resultTime: rawFinal && rawFinal.length > 3 ? rawFinal : null,
                rank: rankVal
            });
        }
    }
  }


  return results;
}
async function parseCompetitionPdf(file, type = 'heat_sheet') {
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

  const eventRegex = /(?:Event\s+)(\d+[A-Z]?\.?\d*)\s+(.+)/i;
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
       const altMatch = fullText.match(/^(\d+[A-Z]?\.?\d*)\s+(.*\b(?:Men|Women|Boys|Girls|Mixed)\b.*)/i);
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

      let rawName = nameVal.trim();
      let nextHeat = null;

      // Filter mashed-in Heat artifacts from the Name string
      const heatNumMatch = rawName.match(/(\d+)\s+of\s+\d+/i);
      if (heatNumMatch) {
          nextHeat = parseInt(heatNumMatch[1], 10);
          rawName = rawName.replace(/heat\s+/i, '').replace(/\d+\s+of\s+\d+.*?$/i, '').trim();
      } else {
          const cell0Match = rawName.match(/heat\s+(\d+)/i);
          if (cell0Match) {
              nextHeat = parseInt(cell0Match[1], 10);
              rawName = rawName.replace(/heat\s+\d+/i, '').trim();
          }
      }

      if (nextHeat !== null) {
          currentHeat = nextHeat; // Update heat for subsequent processing if it bled into the name
      }

      const cleanName = rawName;
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

      let exactAge = true;
      if (pdfAge !== null && pdfAge !== undefined && acc.age !== null && acc.age !== undefined) {
         // Tolerate +/- 1 year difference due to different calculation dates
         exactAge = Math.abs(Number(acc.age) - Number(pdfAge)) <= 1;
      }
      
      const exactTeam = normAccTeam === normPdfTeam;
      const teamOverlaps = normAccTeam && normPdfTeam && (normAccTeam.includes(normPdfTeam) || normPdfTeam.includes(normAccTeam) || jaroWinkler(normAccTeam, normPdfTeam) > 0.85);
      
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

      // Cascade 5: Exact Name Match + Partial Team Match (Age mismatch permitted) -> 0.80
      if (exactName && teamOverlaps) {
        matchConfidence = 0.80;
        matchLog = ["Fallback Match: Exact Name match and Club overlaps despite age mismatch."];
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
