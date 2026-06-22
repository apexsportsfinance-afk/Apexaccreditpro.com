import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify the caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!serviceRoleKey) {
      console.error("SUPABASE_SERVICE_ROLE_KEY is not set");
      return new Response(
        JSON.stringify({ error: "Server misconfigured: missing service role key" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify calling user is authenticated using their token
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const { data: { user: callerUser }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check caller role from profiles table
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", callerUser.id)
      .single();

    if (!callerProfile || (callerProfile.role !== "super_admin" && callerProfile.role !== "event_admin")) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions. Only admins can manage users." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action } = body;

    // --- CREATE USER ---
    if (action === "create") {
      const { email, password, name, role } = body;
      if (!email || !password || !name) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: email, password, name" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Create auth user
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, role: role || "event_admin" }
      });

      if (authError) {
        console.error("Auth create error:", authError);
        return new Response(
          JSON.stringify({ error: authError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Upsert profile row
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .upsert({
          id: authData.user.id,
          email,
          full_name: name,
          role: role || "event_admin",
          updated_at: new Date().toISOString()
        }, { onConflict: "id" });

      if (profileError) {
        console.error("Profile upsert error:", profileError);
      }

      console.log("[manage-users] User created:", email);
      return new Response(
        JSON.stringify({ success: true, user: { id: authData.user.id, email, name, role: role || "event_admin" } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- UPDATE USER ---
    if (action === "update") {
      const { id, email, password, name, role } = body;
      if (!id) {
        return new Response(
          JSON.stringify({ error: "Missing user id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const authUpdates: Record<string, unknown> = {};
      if (email) authUpdates.email = email;
      if (password) authUpdates.password = password;
      if (name || role) {
        authUpdates.user_metadata = {};
        if (name) (authUpdates.user_metadata as Record<string, string>).name = name;
        if (role) (authUpdates.user_metadata as Record<string, string>).role = role;
      }

      if (Object.keys(authUpdates).length > 0) {
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdates);
        if (authError) {
          console.error("Auth update error:", authError);
          return new Response(
            JSON.stringify({ error: authError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Update profile row
      const profileUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (name) profileUpdates.full_name = name;
      if (role) profileUpdates.role = role;
      if (email) profileUpdates.email = email;

      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update(profileUpdates)
        .eq("id", id);

      if (profileError) {
        console.error("Profile update error:", profileError);
      }

      console.log("[manage-users] User updated:", id);
      return new Response(
        JSON.stringify({ success: true, user: { id, email, name, role } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- DELETE USER ---
    if (action === "delete") {
      const { id } = body;
      if (!id) {
        return new Response(
          JSON.stringify({ error: "Missing user id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Delete profile first (cascade will handle it but explicit is safer)
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .delete()
        .eq("id", id);

      if (profileError) {
        console.error("Profile delete error:", profileError);
      }

      // Delete auth user
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (authError) {
        console.error("Auth delete error:", authError);
        return new Response(
          JSON.stringify({ error: authError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("[manage-users] User deleted:", id);
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: create, update, or delete" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});