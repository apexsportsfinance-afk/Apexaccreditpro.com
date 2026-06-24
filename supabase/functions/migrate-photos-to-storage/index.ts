import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const BUCKET = "accreditation-files";

function isBase64Photo(val: string): boolean {
  if (!val) return false;
  if (val.startsWith("data:image")) return true;
  if (val.startsWith("http") || val.startsWith("photos/")) return false;
  return val.length > 512;
}

function base64ToBytes(base64: string): { bytes: Uint8Array; mime: string } {
  let raw = base64;
  let mime = "image/jpeg";
  if (base64.startsWith("data:")) {
    const mimeMatch = base64.match(/^data:([^;]+);base64,/);
    if (mimeMatch) mime = mimeMatch[1];
    raw = base64.split(",")[1];
  }
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { bytes, mime };
}

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for DB/storage operations
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Use anon client to verify the caller's JWT
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token", detail: authError?.message }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const batchSize = Math.min(Number(body.batch_size) || 10, 20);
    const dryRun = body.dry_run === true;

    // Count remaining base64 rows
    const { count: remainingCount } = await supabase
      .from("accreditations")
      .select("*", { count: "exact", head: true })
      .like("photo_url", "data:image%");

    const alsoLong = await supabase
      .from("accreditations")
      .select("*", { count: "exact", head: true })
      .not("photo_url", "is", null)
      .not("photo_url", "like", "http%")
      .not("photo_url", "like", "photos/%")
      .not("photo_url", "like", "data:image%");

    const remaining_base64 = (remainingCount ?? 0) + (alsoLong.count ?? 0);

    if (dryRun) {
      return new Response(
        JSON.stringify({ dry_run: true, remaining_base64 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch a batch of base64 rows
    const { data: rows, error: fetchErr } = await supabase
      .from("accreditations")
      .select("id, photo_url")
      .like("photo_url", "data:image%")
      .range(0, batchSize - 1);

    if (fetchErr) throw fetchErr;

    const results = [];

    for (const row of rows ?? []) {
      if (!row.photo_url || !isBase64Photo(row.photo_url)) {
        results.push({ id: row.id, status: "skipped", reason: "not base64" });
        continue;
      }

      try {
        const { bytes, mime } = base64ToBytes(row.photo_url);
        const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
        const storagePath = `photos/${row.id}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from(BUCKET)
          .upload(storagePath, bytes, { contentType: mime, upsert: true });

        if (uploadErr) {
          results.push({ id: row.id, status: "error", error: uploadErr.message });
          continue;
        }

        const { error: updateErr } = await supabase
          .from("accreditations")
          .update({ photo_url: storagePath })
          .eq("id", row.id);

        if (updateErr) {
          results.push({ id: row.id, status: "error", error: updateErr.message });
          continue;
        }

        results.push({ id: row.id, status: "migrated", path: storagePath });
      } catch (err) {
        results.push({ id: row.id, status: "error", error: String(err) });
      }
    }

    const migrated = results.filter((r) => r.status === "migrated").length;
    const errors = results.filter((r) => r.status === "error").length;
    const newRemaining = Math.max(0, remaining_base64 - migrated);

    return new Response(
      JSON.stringify({
        batch_processed: rows?.length ?? 0,
        migrated,
        errors,
        remaining_base64: newRemaining,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[migrate-photos-to-storage] error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
