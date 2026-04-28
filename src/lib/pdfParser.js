/**
 * Client-side PDF text extractor using pdfjs-dist
 * Uses Uint8Array (not Buffer) — works in browser without any backend
 */

let pdfjsLib = null;

async function getPdfJs() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import("pdfjs-dist");
  // Use unpkg for reliability, fallback to main-thread worker if necessary
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
  return pdfjsLib;
}

/**
 * Extract all text from a PDF File object
 * Returns the full concatenated text string
 */
export async function extractTextFromPdf(file) {
  const pdfjs = await getPdfJs();

  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  const loadingTask = pdfjs.getDocument({ data: uint8Array });
  const pdf = await loadingTask.promise;

  let fullText = "";

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ") + "\n";

    fullText += pageText;
  }

  return fullText;
}

/**
 * Parse extracted PDF text into sport event objects.
 * Handles two common formats:
 *   1. "101 50m Freestyle Men Senior 2025-06-15 09:00 Pool A"
 *   2. "Event 101 - 50m Freestyle (Men, Senior)"
 *
 * Returns array of { eventCode, eventName, gender, ageMin, ageMax,
 *                    session, date, startTime, venue }
 */
export function parsePdfEventsFromText(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 3);

  const events = [];
  const seen = new Set();

  // Pattern 1 — numeric or alphanumeric code at start of line
  const codeLeadRe = /^([A-Z0-9]{1,3}[\-/]?[A-Z0-9]{0,10})\s+(.{4,})/i;
  // Pattern 2 — "Event NNN" or "Evt NNN" prefix
  const eventPrefixRe = /^(?:event|evt)\.?\s+([A-Z0-9\-/]{1,12})[:\-\s]+(.+)/i;
  // Date patterns
  const dateRe = /(\d{4}[-/]\d{2}[-/]\d{2}|\d{2}[-/]\d{2}[-/]\d{4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i;
  const timeRe = /\b(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[AP]M)?)\b/i;
  const ageRangeRe = /(\d{2})\s*[-–]\s*(\d{2})/;
  const genderRe = /\b(men|women|male|female|mixed|open|boys|girls|m\b|w\b|f\b)\b/i;

  for (const line of lines) {
    let code = null;
    let rest = null;

    const m1 = line.match(eventPrefixRe);
    if (m1) {
      code = m1[1].toUpperCase();
      rest = m1[2];
    } else {
      const m2 = line.match(codeLeadRe);
      if (m2 && /^\d{1,4}[A-Z]?$|^[A-Z]{1,3}\d{1,4}$/i.test(m2[1])) {
        code = m2[1].toUpperCase();
        rest = m2[2];
      }
    }

    if (!code || !rest) continue;
    const key = `${code}::${rest.slice(0, 30)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    let eventDate = null;
    let startTime = null;
    let ageMin = null;
    let ageMax = null;
    let gender = null;

    const dm = rest.match(dateRe);
    if (dm) {
      eventDate = normalizeExtractedDate(dm[1]);
      rest = rest.replace(dm[0], " ");
    }

    const tm = rest.match(timeRe);
    if (tm) {
      startTime = tm[1];
      rest = rest.replace(tm[0], " ");
    }

    const am = rest.match(ageRangeRe);
    if (am) {
      ageMin = am[1];
      ageMax = am[2];
      rest = rest.replace(am[0], " ");
    }

    const gm = rest.match(genderRe);
    if (gm) {
      gender = normalizeGender(gm[1]);
      rest = rest.replace(new RegExp(`\\b${gm[1]}\\b`, "i"), " ");
    }

    const eventName = rest
      .replace(/\s{2,}/g, " ")
      .replace(/[()[\]{}]/g, "")
      .replace(/[-–,;]+$/, "")
      .trim();

    if (!eventName || eventName.length < 3) continue;

    events.push({
      eventCode: code,
      eventName,
      gender,
      ageMin,
      ageMax,
      session: null,
      date: eventDate,
      startTime,
      venue: null,
    });
  }

  return events;
}

function normalizeGender(raw) {
  const r = raw.toLowerCase();
  if (["men", "male", "m", "boys"].includes(r)) return "Men";
  if (["women", "female", "w", "f", "girls"].includes(r)) return "Women";
  if (["mixed", "open"].includes(r)) return "Mixed";
  return raw;
}

function normalizeExtractedDate(raw) {
  if (!raw) return null;
  // yyyy-mm-dd or yyyy/mm/dd
  if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(raw)) {
    return raw.replace(/\//g, "-");
  }
  // dd-mm-yyyy or dd/mm/yyyy
  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split(/[-/]/);
    return `${y}-${m}-${d}`;
  }
  // "15 Jun 2025"
  const monthMap = {
    jan: "01", feb: "02", mar: "03", apr: "04",
    may: "05", jun: "06", jul: "07", aug: "08",
    sep: "09", oct: "10", nov: "11", dec: "12"
  };
  const natRe = /(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/i;
  const nm = raw.match(natRe);
  if (nm) {
    const month = monthMap[nm[2].toLowerCase().slice(0, 3)];
    if (month) {
      return `${nm[3]}-${month}-${nm[1].padStart(2, "0")}`;
    }
  }
  return null;
}
