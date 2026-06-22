#!/usr/bin/env node
// ============================================================================
// parse-results-parity.mjs — PDF-extraction parity gate for the medal parser.
//
// Stage-2 gate from docs/EDGE_MIGRATION.md: prove the deployed `parse-results`
// edge function (unpdf) produces the SAME parsed JSON as the Python service
// (`scripts/medal_api.py`, pypdf) on a fixture set of ≥10 real result PDFs.
// Only when this is green do you cut MedalRankings.jsx's /api/bridge/results
// call over to the function URL.
//
// What it does: for every *.pdf in the fixtures dir, POST it (multipart:
// files + competition_name) to the edge fn and, if a Python URL is reachable,
// to the Python service, then deep-compare the `results` arrays.
//
// Usage:
//   # 1. Drop ≥10 real result PDFs here (or pass a dir as arg 1):
//   #      fixtures/hytek-pdfs/*.pdf
//   # 2. Set the edge JWT (staging anon key works; parse-results is JWT-gated):
//   export ANON_KEY="<staging anon JWT>"
//   # 3a. Edge-only smoke (no Python) — dumps parsed JSON per file:
//   node scripts/parse-results-parity.mjs
//   # 3b. Full parity (start the Python bridge first, e.g. on :5001):
//   #      BRIDGE_HOST=127.0.0.1 python scripts/medal_api.py   # in another shell
//   PY_URL="http://127.0.0.1:5001/api/bridge/results" node scripts/parse-results-parity.mjs
//
// Env:
//   ANON_KEY          JWT for the edge fn (required; staging/live anon key)
//   EDGE_URL          parse-results URL (default: staging)
//   PY_URL            Python bridge URL  (optional; omit = edge-only dump)
//   COMPETITION_NAME  competition_name field (default: "Parity Test")
//   PDF_DIR           fixtures dir (default: arg1 or ./fixtures/hytek-pdfs)
//
// Exit code: 0 if all files match (or edge-only run succeeded), 1 on any
// mismatch / error — so it can gate CI.
// ============================================================================
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const EDGE_URL = process.env.EDGE_URL ||
  "https://bieqfzwljxkmmldmlzyb.functions.supabase.co/parse-results";
const PY_URL = process.env.PY_URL || "";
const ANON_KEY = process.env.ANON_KEY || "";
const COMPETITION_NAME = process.env.COMPETITION_NAME || "Parity Test";
const PDF_DIR = resolve(process.argv[2] || process.env.PDF_DIR || "./fixtures/hytek-pdfs");

function fail(msg) { console.error(`\x1b[31m${msg}\x1b[0m`); process.exit(1); }

if (!ANON_KEY) fail("ANON_KEY is required (the edge fn is JWT-gated; pass the project anon key).");
if (!existsSync(PDF_DIR)) fail(`PDF dir not found: ${PDF_DIR}\nCreate it and drop ≥10 real result PDFs in, or pass a dir as arg 1.`);

const pdfs = readdirSync(PDF_DIR).filter((f) => f.toLowerCase().endsWith(".pdf")).sort();
if (pdfs.length === 0) fail(`No .pdf files in ${PDF_DIR}`);
if (pdfs.length < 10) console.warn(`\x1b[33m⚠ only ${pdfs.length} PDFs — the gate wants ≥10 for a real parity claim.\x1b[0m`);

async function postPdf(url, buf, name, extraHeaders = {}) {
  const fd = new FormData();
  fd.append("files", new Blob([buf], { type: "application/pdf" }), name);
  fd.append("competition_name", COMPETITION_NAME);
  const res = await fetch(url, { method: "POST", headers: extraHeaders, body: fd });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { success: false, _raw: text.slice(0, 200) }; }
  return { status: res.status, json };
}

// Canonical form so ordering / key-order differences don't cause false fails.
function canon(results) {
  const norm = (results || []).map((r) => {
    const o = {};
    for (const k of Object.keys(r).sort()) o[k] = r[k];
    return o;
  });
  norm.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return norm;
}

function firstDiff(a, b) {
  const A = canon(a), B = canon(b);
  if (A.length !== B.length) return `result count: edge=${A.length} python=${B.length}`;
  for (let i = 0; i < A.length; i++) {
    const sa = JSON.stringify(A[i]), sb = JSON.stringify(B[i]);
    if (sa !== sb) return `row ${i}:\n      edge=   ${sa}\n      python= ${sb}`;
  }
  return null;
}

const edgeHeaders = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` };
let mismatches = 0, errors = 0;

console.log(`\nparse-results parity — ${pdfs.length} PDFs from ${PDF_DIR}`);
console.log(`edge: ${EDGE_URL}`);
console.log(PY_URL ? `python: ${PY_URL}\n` : `python: (none — edge-only dump)\n`);

for (const name of pdfs) {
  const buf = readFileSync(join(PDF_DIR, name));
  try {
    const edge = await postPdf(EDGE_URL, buf, name, edgeHeaders);
    if (edge.status !== 200 || edge.json.success !== true) {
      console.log(`✗ ${name}  edge HTTP ${edge.status} ${JSON.stringify(edge.json).slice(0, 160)}`);
      errors++; continue;
    }
    const edgeResults = edge.json.results || [];

    if (!PY_URL) {
      console.log(`• ${name}  edge → ${edgeResults.length} medal rows`);
      continue;
    }

    const py = await postPdf(PY_URL, buf, name);
    if (py.status !== 200 || py.json.success !== true) {
      console.log(`✗ ${name}  python HTTP ${py.status} ${JSON.stringify(py.json).slice(0, 160)}`);
      errors++; continue;
    }
    const diff = firstDiff(edgeResults, py.json.results || []);
    if (diff) {
      console.log(`\x1b[31m✗ ${name}  MISMATCH\x1b[0m  ${diff}`);
      mismatches++;
    } else {
      console.log(`\x1b[32m✓ ${name}\x1b[0m  ${edgeResults.length} rows identical`);
    }
  } catch (e) {
    console.log(`✗ ${name}  ERROR ${e.message}`);
    errors++;
  }
}

console.log("");
if (!PY_URL) {
  console.log(`Edge-only run complete (${errors} errors). Set PY_URL to a running medal_api.py to assert parity.`);
  process.exit(errors ? 1 : 0);
}
const total = pdfs.length;
console.log(`Parity: ${total - mismatches - errors}/${total} identical · ${mismatches} mismatch · ${errors} error`);
process.exit(mismatches || errors ? 1 : 0);
