import { createClient } from "@supabase/supabase-js";

// [APX-SEC] No hardcoded credential fallback. Configuration must come from the
// build-time environment (.env / hosting env vars). Failing fast surfaces a
// misconfiguration instead of silently pointing at a baked-in project.
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase configuration: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
