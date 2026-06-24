import jaroWinkler from 'jaro-winkler';
import * as XLSX from '@e965/xlsx';

/**
 * HEATSHEET EVENT PARSERS
 * Extract metadata from standard event titles like "Girls 12 & Over 1500 LC Meter Freestyle"
 */
export function parseGenderFromEvent(eventName) {
  if (!eventName) return 'Mixed';
  const lower = eventName.toLowerCase();
  if (lower.includes('girl') || lower.includes('women') || lower.includes('female')) return 'Female';
  if (lower.includes('boy') || lower.includes('men') || lower.includes('male')) return 'Male';
  return 'Mixed';
}

export function parseAgeCatFromEvent(eventName) {
  if (!eventName) return 'Open';
  const match = eventName.match(/(\d+\s*&\s*Over|\d+\s*-\s*\d+|\d+\s*&\s*Under|\d{1,2}\s*Year)/i);
  return match ? match[1].trim() : 'Open';
}

export function normalizeTeam(teamStr) {
  return (teamStr || '').replace(/\s*\([A-Z]+\)$/i, '').trim().toLowerCase();
}

/**
 * Normalized Age Calculator for consistent database matching
 */
export function calculateAge(birthDateStr) {
  if (!birthDateStr) return null;
  const birthDate = new Date(birthDateStr);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export function normalizeName(name, stripMiddle = false) {
  let n = (name || '').trim().toLowerCase();
  if (stripMiddle) {
    const parts = n.split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0]} ${parts[parts.length - 1]}`;
    }
  }
  return n;
}

let pdfjsLib = null;

async function getPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  return pdfjsLib;
}

/**
 * Universal Parser for HYTEK Meet Manager Heat Sheets.
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
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    const rows = [];
    for (const row of rawRows) {
      if (!row || !row.length) continue;
      rows.push(row);
    }

    return processCompetitionRows(rows, type);
  } catch (err) {
    throw new Error("Failed to parse Excel file.");
  }
}

export async function parseCompetitionHtml(file, type = 'heat_sheet') {
  const text = await file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');

  // APEX: Table-aware HTML extraction
  const tables = doc.querySelectorAll('table');
  const allRows = [];

  if (tables.length > 0) {
    console.log(`APEX_DEBUG: Found ${tables.length} tables. Extracting...`);
    tables.forEach(table => {
      Array.from(table.rows).forEach(tr => {
        const rowData = Array.from(tr.cells).map(td => td.innerText.trim());
        if (rowData.length > 0) allRows.push(rowData);
      });
    });
  }

  // Fallback to text lines if no tables or few rows found
  if (allRows.length < 10) {
    const bodyText = doc.body?.innerText || doc.body?.textContent || "";
    const lines = bodyText.split(/\r?\n/);
    for (const line of lines) {
      if (line.trim().length === 0) continue;
      allRows.push([line]); 
    }
  }

  if (allRows.length === 0) return [];
  return processCompetitionRows(allRows, type);
}

function calculateCallRoomTime(startTime) {
  if (!startTime) return null;
  try {
    const match = startTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/i);
    if (!match) return null;
    
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const ampm = match[3] ? match[3].toUpperCase() : null;
    
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    
    let totalMinutes = hours * 60 + minutes - 20;
    if (totalMinutes < 0) totalMinutes += 24 * 60;
    
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    const finalAMPM = h < 12 ? 'AM' : 'PM';
    const displayH = h % 12 === 0 ? 12 : h % 12;
    const displayM = String(m).padStart(2, '0');
    
    return ampm ? `${displayH}:${displayM} ${finalAMPM}` : `${String(h).padStart(2, '0')}:${displayM}`;
  } catch (e) {
    return null;
  }
}

function processCompetitionRows(allRows, type = 'heat_sheet') {
  console.log(`APEX_DEBUG: Starting Multi-Line row processing for [${allRows.length}] lines...`);
  const results = [];
  let currentEventCode = null;
  let currentEventName = null;
  let currentHeat = null;
  let currentGender = 'Mixed';
  let currentSession = null;
  let currentRaceTime = null;
  let currentCallRoomTime = null;
  
  let pendingPool = "";
  const eventRegex = /event\s*(\d+)\s*(.+)/i;
  // Session line can look like: "Session 1", "Session: 1", "Session 1 - Morning", "Session 1  9:00 AM"
  const sessionRegex = /^\s*session\s*[:\.]?\s*(\d+)/i;

  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i];
    const fullRowText = row.join(" ").trim();
    const cleanLower = fullRowText.toLowerCase();

    // Session detection
    const sessionRegex = /session\s*[:\.]?\s*(\d+)?\s*(.*)/i;
    const sMatch = fullRowText.match(sessionRegex);
    if (sMatch) {
      const sNum = sMatch[1] || '';
      const sName = sMatch[2] || '';
      currentSession = (sNum + ' ' + sName).trim();
      console.log("APEX_DEBUG: Detected Session:", currentSession);
      const sessionTimeMatch = fullRowText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
      if (sessionTimeMatch) {
        currentRaceTime = sessionTimeMatch[1].trim();
        currentCallRoomTime = calculateCallRoomTime(currentRaceTime);
      }
      continue;
    }

    // Reset gender and calculate Session on event headers
    const eventMatch = fullRowText.match(eventRegex);
    if (eventMatch) {
      currentEventCode = eventMatch[1];
      currentEventName = eventMatch[2].trim();
      currentGender = parseGenderFromEvent(currentEventName);
      
      // APX-Fix: Calculate session from first digit of event code (e.g., 307 -> Session 3)
      if (currentEventCode && currentEventCode.length > 0) {
        const firstDigit = currentEventCode.charAt(0);
        if (!isNaN(firstDigit)) {
          currentSession = `Session ${firstDigit}`;
        }
      }
      
      pendingPool = ""; 
      continue;
    }

    if (cleanLower.includes('heat')) {
       const hm = fullRowText.match(/heat\s+(\d+)/i);
       if (hm) currentHeat = parseInt(hm[1], 10);
       const heatTimeMatch = fullRowText.match(/(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
       if (heatTimeMatch) {
         currentRaceTime = heatTimeMatch[1].trim();
         currentCallRoomTime = calculateCallRoomTime(currentRaceTime);
       }
       continue;
    }

    if (currentEventCode && cleanLower.length > 1) {
      const isSeparator = /^[=\-*\s]+$/.test(fullRowText);
      const isColumnHeader = /\b(name|age|team|time|seed|finals|prelim)\b/i.test(fullRowText);
      if (isSeparator || isColumnHeader) {
        pendingPool = "";
        continue;
      }

      const isEmptyLane = /^\d+\s*$/.test(fullRowText);
      if (isEmptyLane) {
        pendingPool = "";
        continue;
      }

      pendingPool = (pendingPool + " " + fullRowText).trim();
      const cleanPool = pendingPool.replace(/\|/g, '').replace(/\s+/g, ' ');
      
      const eventOrderMatch = cleanPool.match(/^([A-Za-z\s,.\'\-]+?)\s+(\d{1,2})\s+(\d+:?\d*\.\d+|NT|NS|SCR|DQ|--)\s+H(\d+)\s*\/\s*L(\d+)\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)\s+(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i);
      
      if (eventOrderMatch) {
         results.push({
           eventCode: currentEventCode,
           eventName: currentEventName,
           athleteName: eventOrderMatch[1].trim(),
           gender: currentGender,
           age: parseInt(eventOrderMatch[2], 10),
           rank: null,
           lane: parseInt(eventOrderMatch[5], 10),
           resultTime: null,
           seedTime: eventOrderMatch[3].trim(),
           teamName: "", 
           heat: parseInt(eventOrderMatch[4], 10),
           sessionName: currentSession,
           raceTime: eventOrderMatch[7].trim(),
           callRoomTime: eventOrderMatch[6].trim()
         });
         pendingPool = "";
         continue;
      }

      // HY-TEK Standard Heat Sheet Line - ULTIMATE RESILIENCE VERSION
      // Group 1: Lane, Group 2: Name, Group 3: Age, Group 4: Team, Group 5: Time, Group 6: Session Time
      const hytekHeatMatch = cleanPool.match(/^(\d+)\s+(.+?)\s+(\d{1,3})\s+(.+?)\s+(\d+:?\d*\.\d+|NT|NS|SCR|DQ|--)(?:\s+(\d{1,2}:\d{2}\s*[AP]M))?/i);
      
      let finalRow = null;

      if (hytekHeatMatch) {
        finalRow = {
          athleteName: hytekHeatMatch[2].trim(),
          age: parseInt(hytekHeatMatch[3], 10),
          teamName: hytekHeatMatch[4].trim(),
          lane: parseInt(hytekHeatMatch[1], 10),
          seedTime: hytekHeatMatch[5].trim(),
          inlineTime: hytekHeatMatch[6] ? hytekHeatMatch[6].trim() : null
        };
      } else {
        // FALLBACK: Best-guess line parsing for non-standard HY-TEK layouts
        const parts = cleanPool.split(/\s{2,}/); // Split by 2 or more spaces
        if (parts.length >= 4) {
          const lane = parseInt(parts[0], 10);
          if (!isNaN(lane)) {
             finalRow = {
               athleteName: parts[1].trim(),
               age: parseInt(parts[2], 10) || 0,
               teamName: parts[3].trim(),
               lane: lane,
               seedTime: parts[4] || "NT",
               inlineTime: null
             };
          }
        }
      }

      if (finalRow) {
        const raceTime = finalRow.inlineTime || currentRaceTime;
        const callRoom = finalRow.inlineTime ? calculateCallRoomTime(finalRow.inlineTime) : currentCallRoomTime;

        results.push({
          eventCode: currentEventCode,
          eventName: currentEventName,
          athleteName: finalRow.athleteName,
          gender: currentGender,
          age: finalRow.age,
          rank: null,
          lane: finalRow.lane,
          resultTime: null,
          seedTime: finalRow.seedTime,
          teamName: finalRow.teamName,
          heat: currentHeat || 1,
          sessionName: currentSession,
          raceTime: raceTime,
          callRoomTime: callRoom
        });
        pendingPool = "";
        continue;
      }

      const universalMatch = cleanPool.match(/([^\d\n\r]{2,})\s+(\d{1,2})([\d-]*)\s*([^\d\n\r]{3,})\s+(\d+:?\d*\.\d+[qQ]?|NT|NS|SCR|DQ)/i);
      if (universalMatch) {
          const isResult = (type === 'event_result');
          results.push({
            eventCode: currentEventCode,
            eventName: currentEventName,
            athleteName: universalMatch[4].replace(/Name|Team|Finals|Time|Prelim|Seed/gi, '').trim(),
            gender: currentGender,
            age: parseInt(universalMatch[2], 10),
            rank: isResult ? (parseInt(universalMatch[3], 10) || 0) : null,
            lane: isResult ? null : (parseInt(universalMatch[3], 10) || 0),
            resultTime: isResult ? universalMatch[5].trim() : null,
            seedTime: isResult ? null : universalMatch[5].trim(),
            teamName: universalMatch[1].trim(),
            heat: currentHeat || 1,
            sessionName: currentSession,
            raceTime: currentRaceTime,
            callRoomTime: currentCallRoomTime
          });
          pendingPool = ""; 
          continue;
      }
      
      if (pendingPool.split(" ").length > 15) pendingPool = "";
    }
  }
  return results;
}

async function parseCompetitionPdf(file, type = 'heat_sheet') {
  const pdfjs = await getPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const allRows = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const itemsByRow = {};
    for (const item of content.items) {
      const y = Math.round(item.transform[5]);
      if (!itemsByRow[y]) itemsByRow[y] = [];
      itemsByRow[y].push(item);
    }
    const sortedY = Object.keys(itemsByRow).sort((a, b) => b - a);
    for (const y of sortedY) {
      const row = itemsByRow[y].sort((a, b) => a.transform[4] - b.transform[4]).map(it => it.str.trim()).filter(Boolean);
      if (row.length > 0) allRows.push(row);
    }
  }

  return processCompetitionRows(allRows, type);
}

/**
 * RESILIENT ATHLETE MATCHING ENGINE
 * Handles name concatenation, club partial matches, and gender locking.
 */
export async function matchAthleteEvents(parsedRows, accreditationRecords) {
  console.log(`DIAC_DEBUG: Matching [${parsedRows.length}] rows against [${accreditationRecords.length}] accreditations.`);
  const bestMatches = [];
  const seenMatchKeys = new Set();

  // APX-PERF: Precompute normalized name tokens / gender / club / age ONCE per
  // accreditation instead of re-deriving them inside the inner loop for every
  // parsed row. Turns O(rows × accs × stringwork) into O(accs + rows × accs).
  const accIndex = accreditationRecords.map(acc => {
    const cleanDbName = (acc.name || '').toLowerCase().replace(/[,.-]/g, ' ');
    return {
      acc,
      cleanDbName,
      dbTokens: cleanDbName.split(/\s+/).filter(t => t.length >= 2),
      dbGen: (acc.gender || '').toLowerCase(),
      dbClub: (acc.club_name || '').toLowerCase(),
      dbAge: acc.age
    };
  });

  for (const row of parsedRows) {
    const pdfName = (row.athleteName || '').trim();
    if (!pdfName) continue;

    // Precompute the parsed-row fields once per row as well
    const rowGen = (row.gender || '').toLowerCase();
    const cleanPdfName = pdfName.toLowerCase().replace(/[,.-]/g, ' ');
    const pdfTokens = cleanPdfName.split(/\s+/).filter(t => t.length >= 2);
    if (pdfTokens.length === 0) continue;
    const pdfTeam = (row.teamName || row.team || '').toLowerCase();
    const rowAge = row.age ? parseInt(row.age, 10) : null;

    let bestDBMatch = null;
    let highestScore = 0;

    for (const entry of accIndex) {
      const { acc, dbTokens, dbGen, dbClub, dbAge } = entry;

      if (rowGen !== 'mixed' && rowGen !== dbGen) {
         if (!(rowGen.startsWith(dbGen.charAt(0)) || dbGen.startsWith(rowGen.charAt(0)))) {
            continue;
         }
      }

      if (dbTokens.length === 0) continue;

      let matchCount = 0;
      pdfTokens.forEach(pt => {
        if (dbTokens.some(dt => dt.includes(pt) || pt.includes(dt))) {
          matchCount++;
        }
      });

      const avgRatio = matchCount / Math.max(pdfTokens.length, dbTokens.length);
      const minRatio = 0.2; // APEX: Turbo loose matching

      if (avgRatio >= minRatio && matchCount >= 1) {
         let score = avgRatio * 20;

         if (pdfTeam && dbClub) {
            if (dbClub.includes(pdfTeam) || pdfTeam.includes(dbClub)) {
               score += 20;
            }
         }

         if (rowAge && dbAge) {
            const ageDiff = Math.abs(rowAge - parseInt(dbAge, 10));
            if (ageDiff === 0) score += 5;
            else if (ageDiff > 1) score -= 15;
         }

         const minScoreThreshold = 5; // APEX: Turbo loose matching
         if (score > highestScore && score >= minScoreThreshold) {
            highestScore = score;
            bestDBMatch = acc;
         }
      }
    }

    if (bestDBMatch && highestScore > 0) {
      const roundStr = row.eventName.toLowerCase().includes('prelim') ? 'Prelims' : 'Finals';
      const key = `${bestDBMatch.id}|${row.eventCode}|${roundStr}`;
      
      if (!seenMatchKeys.has(key)) {
        bestMatches.push({
          accreditation_id: bestDBMatch.id,
          event_id: row.eventCode,
          athlete_name: row.athleteName, // Fixed: Use athleteName instead of swimmerName
          gender: row.gender,
          heat: row.heat,
          lane: row.lane,
          round: roundStr,
          event_code: row.eventCode,
          event_number: row.eventCode,
          event_name: row.eventName,
          seed_time: row.seedTime,
          team_name: row.teamName,
          session_name: row.sessionName,
          race_time: row.raceTime,
          call_room_time: row.callRoomTime,
          matched: true
        });
        seenMatchKeys.add(key);
      }
    }
  }

  return bestMatches;
}
