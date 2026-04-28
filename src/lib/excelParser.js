import * as XLSX from "xlsx";

/**
 * Parse Excel file → array of sport event objects
 * Expected columns (case-insensitive):
 * EventCode, EventName, Gender, AgeMin, AgeMax, Session, Date, StartTime, Venue
 */
export async function parseExcelEvents(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        const events = rows.map((row, idx) => {
          const get = (keys) => {
            for (const k of keys) {
              const found = Object.keys(row).find(rk => rk.toLowerCase().replace(/[\s_]/g, "") === k.toLowerCase());
              if (found && row[found] !== "") return String(row[found]).trim();
            }
            return "";
          };
          const rawDate = get(["date", "eventdate"]);
          const parsedDate = parseExcelDate(rawDate);
          return {
            eventCode: get(["eventcode", "code"]) || `EVT-${idx + 1}`,
            eventName: get(["eventname", "name", "event"]),
            gender: get(["gender", "sex"]),
            ageMin: get(["agemin", "minage", "agefrom"]) || null,
            ageMax: get(["agemax", "maxage", "ageto"]) || null,
            session: get(["session"]),
            date: parsedDate,
            startTime: get(["starttime", "time"]),
            venue: get(["venue", "location", "pool"])
          };
        }).filter(e => e.eventName);
        resolve(events);
      } catch (err) {
        reject(new Error("Failed to parse Excel: " + err.message));
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

function parseExcelDate(raw) {
  if (!raw) return null;
  // Excel serial number
  if (!isNaN(raw) && Number(raw) > 1000) {
    const d = XLSX.SSF.parse_date_code(Number(raw));
    if (d) return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
  }
  // String date
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split("T")[0];
  }
  return null;
}

/**
 * Naive PDF text → events parser
 * Looks for lines matching: CODE  NAME  GENDER  AGEMIN-AGEMAX  SESSION  DATE  TIME  VENUE
 */
export function parsePdfTextToEvents(text) {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const events = [];
  // Pattern: starts with alphanumeric code
  const codeRe = /^([A-Z0-9\-]{2,15})\s+(.+)/;
  for (const line of lines) {
    if (line.length < 5) continue;
    const m = line.match(codeRe);
    if (!m) continue;
    const [, code, rest] = m;
    const parts = rest.split(/\s{2,}|\t/);
    if (parts.length < 1) continue;
    const dateRe = /(\d{4}-\d{2}-\d{2}|\d{2}[\/\-]\d{2}[\/\-]\d{4})/;
    const timeRe = /(\d{1,2}:\d{2})/;
    const ageRe = /(\d+)[–\-](\d+)/;
    let eventDate = null, startTime = null, ageMin = null, ageMax = null;
    const remaining = [];
    for (const p of parts) {
      const dm = p.match(dateRe);
      if (dm) { eventDate = normalizeDate(dm[1]); continue; }
      const tm = p.match(timeRe);
      if (tm) { startTime = tm[1]; continue; }
      const am = p.match(ageRe);
      if (am) { ageMin = am[1]; ageMax = am[2]; continue; }
      remaining.push(p);
    }
    events.push({
      eventCode: code,
      eventName: remaining[0] || code,
      gender: remaining[1] || null,
      ageMin,
      ageMax,
      session: remaining[2] || null,
      date: eventDate,
      startTime,
      venue: remaining[3] || null
    });
  }
  return events;
}

function normalizeDate(raw) {
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parts = raw.split(/[\/\-]/);
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`;
  }
  return null;
}
