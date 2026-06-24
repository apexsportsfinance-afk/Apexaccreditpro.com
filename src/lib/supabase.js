import { createClient } from "@supabase/supabase-js";

// APX-FIX: strip ALL whitespace from the URL/key. A stray trailing newline or
// space in the Vercel VITE_SUPABASE_* env var made the baked-in value invalid,
// so supabase-js threw "Failed to execute 'fetch' on 'Window': Invalid value"
// on every request (login + all data calls) — the request never left the
// browser. URLs and JWTs never legitimately contain whitespace, so removing it
// makes the client resilient to that paste mistake.
const clean = (v) => (v || "").replace(/\s/g, "");

// [APX-SEC] No hardcoded credential fallback. Configuration must come from the
// build-time environment (.env / hosting env vars). Failing fast surfaces a
// misconfiguration instead of silently pointing at a baked-in project.
export const supabaseUrl = clean(import.meta.env.VITE_SUPABASE_URL);
export const supabaseAnonKey = clean(import.meta.env.VITE_SUPABASE_ANON_KEY);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase configuration: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
