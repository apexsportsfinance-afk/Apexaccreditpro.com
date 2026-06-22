import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const BUCKET = "accreditation-files";
const EXPIRES_IN = 600; // 10 minutes

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify the user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify the JWT belongs to an authenticated user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    // Accept either a single `path` or an array `paths`
    const rawPaths: string[] = [];
    if (body.path && typeof body.path === "string") rawPaths.push(body.path);
    if (Array.isArray(body.paths)) rawPaths.push(...body.paths);

    if (rawPaths.length === 0) {
      return new Response(JSON.stringify({ error: "No path(s) provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate signed URLs in parallel
    const results: Record<string, string | null> = {};
    await Promise.all(
      rawPaths.map(async (p) => {
        const { data, error } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(p, EXPIRES_IN);
        results[p] = error ? null : (data?.signedUrl ?? null);
      })
    );

    return new Response(
      JSON.stringify({ urls: results, expires_in: EXPIRES_IN }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[get-photo-signed-url] error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
