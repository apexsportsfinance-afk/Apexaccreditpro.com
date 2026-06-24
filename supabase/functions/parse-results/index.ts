// ============================================================================
// parse-results — Hy-Tek medal parser (Supabase Edge Function)
//
// STATUS: SCAFFOLD — not yet the source of truth. This replaces the Python
// Flask bridge (scripts/medal_api.py + the /api/bridge/results proxy in
// server.js). The parsing logic lives in ../_shared/hytekParser.ts and is unit-
// tested for parity with the Python parser. PDF text extraction here uses
// `unpdf` (Deno-compatible). Do NOT cut MedalRankings.jsx over until the Stage 2
// parity gate in docs/EDGE_MIGRATION.md passes on a fixture set of real PDFs.
//
// Mirrors the Python endpoint contract:
//   - multipart/form-data: files[] (PDFs) + competition_name
//   - returns { success: true, results: MedalResult[] }
// ============================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.11.0";
import { parseHytekResults, type MedalResult } from "../_shared/hytekParser.ts";

const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5180",
  "http://localhost:5173",
  "https://accreditation.apexsports.ae",
];
const extraOrigins = (Deno.env.get("ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = new Set([...DEFAULT_ALLOWED_ORIGINS, ...extraOrigins]);

function corsHeaders(origin: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : DEFAULT_ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
}

async function pdfToText(file: File): Promise<string> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocumentProxy(buffer);
  const { text } = await extractText(pdf, { mergePages: true });
  return Array.isArray(text) ? text.join("\n") : text;
}

serve(async (req: Request) => {
  const headers = corsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers,
    });
  }

  try {
    const form = await req.formData();
    const competitionName = (form.get("competition_name") as string) || "Unknown Competition";
    const files = form.getAll("files").filter((f): f is File => f instanceof File);

    if (files.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "No files provided" }), {
        status: 400,
        headers,
      });
    }

    const allResults: MedalResult[] = [];
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".pdf")) continue;
      try {
        const text = await pdfToText(file);
        allResults.push(...parseHytekResults(text, competitionName));
      } catch (err) {
        // Match the Python behavior: skip an unparseable file, keep going.
        console.error(`Failed to parse ${file.name}:`, (err as Error).message);
      }
    }

    return new Response(JSON.stringify({ success: true, results: allResults }), {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error("parse-results error:", (err as Error).message);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to parse results" }),
      { status: 500, headers }
    );
  }
});
