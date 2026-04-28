import jaroWinkler from 'jaro-winkler';
import * as XLSX from 'xlsx';

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

  // For HY-TEK pre-formatted files, we pass each raw line as a single-element row
  // so the downstream processCompetitionRows can apply HY-TEK regex directly
  const bodyText = doc.body?.innerText || "";
  const lines = bodyText.split(/\r?\n/);
  
  const allRows = [];
  for (const line of lines) {
    // Keep original line (with spaces) for regex matching — do NOT collapse spaces
    if (line.trim().length === 0) continue;
    allRows.push([line]); // Pass each raw line as a single-element array
  }

  if (allRows.length === 0) return [];
  return processCompetitionRows(allRows, type);
}

function processCompetitionRows(allRows, type = 'heat_sheet') {
  console.log(`DIAC_DEBUG: Starting Multi-Line row processing for [${allRows.length}] lines...`);
  const results = [];
  let currentEventCode = null;
  let currentEventName = null;
  let currentHeat = null;
  let currentGender = 'Mixed';
  
  let pendingPool = "";
  const eventRegex = /event\s*(\d+)\s*(.+)/i;

  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i];
    const fullRowText = row.join(" ").trim();
    const cleanLower = fullRowText.toLowerCase();

    // Reset gender on event headers
    const eventMatch = fullRowText.match(eventRegex);
    if (eventMatch) {
      currentEventCode = eventMatch[1];
      currentEventName = eventMatch[2].trim();
      currentGender = parseGenderFromEvent(currentEventName);
      pendingPool = ""; 
      continue;
    }

    if (cleanLower.includes('heat')) {
       const hm = fullRowText.match(/heat\s+(\d+)/i);
       if (hm) currentHeat = parseInt(hm[1], 10);
       continue;
    }

    if (currentEventCode && cleanLower.length > 1) {
      // Flush pool on HY-TEK separator lines (=====) and column headers (Name/Age/Team)
      const isSeparator = /^[=\-*\s]+$/.test(fullRowText);
      const isColumnHeader = /\b(name|age|team|time|seed|finals|prelim)\b/i.test(fullRowText);
      if (isSeparator || isColumnHeader) {
        pendingPool = "";
        continue;
      }

      // Empty lane: only a bare digit (e.g. "1" or "2") – flush and skip
      const isEmptyLane = /^\d+\s*$/.test(fullRowText);
      if (isEmptyLane) {
        pendingPool = "";
        continue;
      }

      pendingPool = (pendingPool + " " + fullRowText).trim();
      
      // HY-TEK Matcher
      const hytekHeatMatch = pendingPool.match(/^(\d+)\s+([A-Za-z\s,.\'-]+?)\s+(\d{1,2})\s+([A-Za-z\s.]+?)\s+(\d+:?\d*\.\d+|NT|NS|SCR|DQ)/i);
      
      if (hytekHeatMatch) {
        const athleteName = hytekHeatMatch[2].trim();
        console.log(`DIAC_DEBUG: Parsed Row | Event: ${currentEventCode} | Athlete: ${athleteName} | Gender: ${currentGender} | Age: ${hytekHeatMatch[3]}`);
        
        results.push({
          eventCode: currentEventCode,
          eventName: currentEventName,
          athleteName: athleteName,
          gender: currentGender,
          age: parseInt(hytekHeatMatch[3], 10),
          rank: null,
          lane: parseInt(hytekHeatMatch[1], 10),
          resultTime: null,
          seedTime: hytekHeatMatch[5].trim(),
          teamName: hytekHeatMatch[4].trim(),
          heat: currentHeat || 1
        });
        pendingPool = "";
        continue;
      }

      // Result Matcher
      const universalMatch = pendingPool.match(/([^\d\n\r]{2,})\s+(\d{1,2})([\d-]*)\s*([^\d\n\r]{3,})\s+(\d+:?\d*\.\d+[qQ]?|NT|NS|SCR|DQ)/i);
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
            heat: currentHeat || 1
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

  for (const row of parsedRows) {
    const pdfName = (row.athleteName || '').trim();
    if (!pdfName) continue;

    let bestDBMatch = null;
    let highestScore = 0;

    for (const acc of accreditationRecords) {
      // 1. Gender Filter (STRICT) - Both normalized to 'Male'/'Female'
      const rowGen = (row.gender || '').toLowerCase();
      const dbGen = (acc.gender || '').toLowerCase();
      
      if (rowGen !== 'mixed' && rowGen !== dbGen) {
         // Some databases use abbreviated genders (e.g. M/F)
         if (!(rowGen.startsWith(dbGen.charAt(0)) || dbGen.startsWith(rowGen.charAt(0)))) {
            continue;
         }
      }

      // 2. Name Cleaning and Tokenization
      const cleanPdfName = pdfName.toLowerCase().replace(/[,.-]/g, ' ');
      const cleanDbName = (acc.name || '').toLowerCase().replace(/[,.-]/g, ' ');
      
      const pdfTokens = cleanPdfName.split(/\s+/).filter(t => t.length > 2);
      const dbTokens = cleanDbName.split(/\s+/).filter(t => t.length > 2);
      
      if (pdfTokens.length === 0 || dbTokens.length === 0) continue;

      // 3. Token Set Intersect (Resilient to concatenation)
      let matchCount = 0;
      pdfTokens.forEach(pt => {
        if (dbTokens.some(dt => dt.includes(pt) || pt.includes(dt))) {
          matchCount++;
        }
      });
      
      // Temporary debug for "0 verified matches" issue on live site
      if (pdfName.length > 3 && cleanDbName.includes(pdfTokens[0])) {
        console.log(`DIAC_DEBUG: Matching Candidate - PDF: [${pdfTokens.join()}] | DB: [${dbTokens.join()}] -> MatchCount: ${matchCount}`);
      }
      
      const avgRatio = matchCount / Math.max(pdfTokens.length, dbTokens.length);
      const minRatio = pdfTokens.length === 1 ? 0.9 : 0.45;

      if (avgRatio >= minRatio && matchCount >= 1) { 
         let score = avgRatio * 20;
         
         // 4. Club Match Bonus
         const pdfTeam = (row.teamName || row.team || '').toLowerCase();
         const dbClub = (acc.club_name || '').toLowerCase();
         if (pdfTeam && dbClub) {
            if (dbClub.includes(pdfTeam) || pdfTeam.includes(dbClub)) {
               score += 20;
            }
         }

         // 5. Age Match 
         const dbAge = acc.age;
         if (row.age && dbAge) {
            const ageDiff = Math.abs(parseInt(row.age, 10) - parseInt(dbAge, 10));
            if (ageDiff === 0) score += 5;
            else if (ageDiff > 1) score -= 15; // Soft penalty instead of nuclear wipe
         }
         
         const minScoreThreshold = 12; 
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
          event_code: row.eventCode,
          event_name: row.eventName,
          heat: row.heat,
          lane: row.lane,
          rank: row.rank,
          result_time: row.resultTime,
          round: roundStr,
          seed_time: row.seedTime,
          matched: true
        });
        seenMatchKeys.add(key);
      }
    }
  }

  return bestMatches;
}
