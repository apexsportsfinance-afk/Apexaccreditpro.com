import { createClient } from "@supabase/supabase-js";

// APX-FIX: strip ALL whitespace from the URL/key. A stray trailing newline or
// space in the Vercel VITE_SUPABASE_* env var made the baked-in value invalid,
// so supabase-js threw "Failed to execute 'fetch' on 'Window': Invalid value"
// on every request (login + all data calls) — the request never left the
// browser. URLs and JWTs never legitimately contain whitespace, so removing it
// makes the client resilient to that paste mistake.
const clean = (v) => (v || "").replace(/\s/g, "");

export const supabaseUrl =
  clean(import.meta.env.VITE_SUPABASE_URL) ||
  "https://dixelomafeobabahqeqg.supabase.co";

export const supabaseAnonKey =
  clean(import.meta.env.VITE_SUPABASE_ANON_KEY) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeGVsb21hZmVvYmFiYWhxZXFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzA4MzYsImV4cCI6MjA4NjkwNjgzNn0.YD1lj0T6kFoM2XyeYonIC3bmLiPkKBvmXEHEr5VMaGM";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
