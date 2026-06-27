import { supabase, supabaseUrl } from "../supabase";
import { handleResponse } from "../apiHelpers";
import { AuditAPI } from "./audit";
import type { DbRow } from "./_types";

const EDGE_URL = `${supabaseUrl}/functions/v1/manage-users`;

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: string;
  avatar?: string;
  createdAt?: string;
  type?: string;
  isAuthUser?: boolean;
}

async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

async function edgeCall(session: { access_token: string }, body: DbRow): Promise<DbRow> {
  const response = await fetch(EDGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    // Surface the function's actual message (e.g. "email already registered",
    // "Password should be at least 6 characters") instead of a bare status code.
    let detail = "";
    try {
      const errBody = await response.json();
      detail = errBody?.error || errBody?.message || "";
    } catch {
      // non-JSON body; fall back to the status code below
    }
    throw new Error(detail || `Edge function error: ${response.status}`);
  }
  return response.json();
}

export const UsersAPI = {
  getAll: async (): Promise<AppUser[]> => {
    try {
      const session = await getSession();
      if (session?.access_token) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        try {
          const response = await fetch(EDGE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}` },
            body: JSON.stringify({ action: "list" }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (response.ok) {
            const data = await response.json();
            if (data.users) return data.users.map((u: DbRow) => ({
              id: u.id, email: u.email, name: u.full_name || u.email,
              role: u.role || "viewer", createdAt: u.created_at, type: "Admin Staff", isAuthUser: true
            }));
          }
        } catch (fetchErr) {
          clearTimeout(timeoutId);
          throw fetchErr;
        }
      }
    } catch (err) {
      console.warn("Edge list failed or timed out, falling back to profiles:", err);
    }

    const data = await handleResponse(() => supabase.from("profiles").select("*").order("created_at", { ascending: false }));
    return (data || []).map((u: DbRow) => ({
      id: u.id, email: u.email, name: u.full_name || u.email,
      role: u.role || "viewer", avatar: u.avatar_url, createdAt: u.created_at, type: "Admin Staff"
    }));
  },

  getCurrentUser: async (): Promise<Partial<AppUser> | null> => {
    const session = await getSession();
    if (!session?.user) return null;
    return {
      id: session.user.id,
      email: session.user.email,
      name: session.user.user_metadata?.name || session.user.email,
      role: session.user.user_metadata?.role || "event_admin"
    };
  },

  authenticate: async (email: string, password: string): Promise<Partial<AppUser> | null> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return null;
    return {
      id: data.user.id, email: data.user.email,
      name: data.user.user_metadata?.name || email,
      role: data.user.user_metadata?.role || "viewer"
    };
  },

  logout: async (): Promise<void> => {
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  },

  create: async (userData: DbRow): Promise<DbRow> => {
    const session = await getSession();
    if (!session?.access_token) throw new Error("Not authenticated");
    const data = await edgeCall(session, { action: "create", ...userData });
    AuditAPI.log("user_created", { email: userData.email });
    return data.user;
  },

  update: async (id: string, updates: DbRow): Promise<DbRow> => {
    const session = await getSession();
    if (!session?.access_token) throw new Error("Not authenticated");
    const data = await edgeCall(session, { action: "update", id, ...updates });
    AuditAPI.log("user_updated", { userId: id });
    return data.user;
  },

  delete: async (id: string): Promise<boolean> => {
    const session = await getSession();
    if (!session?.access_token) throw new Error("Not authenticated");
    await edgeCall(session, { action: "delete", id });
    AuditAPI.log("user_deleted", { userId: id });
    return true;
  },

  getAccessMappings: async (): Promise<Record<string, string[]>> => {
    const data = await handleResponse(() => supabase.from("global_settings").select("value").eq("key", "user_event_access").maybeSingle());
    try { return data?.value ? JSON.parse(data.value) : {}; } catch { return {}; }
  },

  updateAccessMapping: async (userId: string, eventIds: string[]): Promise<boolean> => {
    const existing = await UsersAPI.getAccessMappings();
    if (eventIds?.length) existing[userId] = eventIds; else delete existing[userId];
    await handleResponse(() => supabase.from("global_settings").upsert({ key: "user_event_access", value: JSON.stringify(existing) }, { onConflict: 'key' }));
    return true;
  },

  getModuleAccessMappings: async (): Promise<Record<string, string[]>> => {
    const data = await handleResponse(() => supabase.from("global_settings").select("value").eq("key", "user_module_access").maybeSingle());
    try { return data?.value ? JSON.parse(data.value) : {}; } catch { return {}; }
  },

  updateModuleAccessMapping: async (userId: string, modules: string[]): Promise<boolean> => {
    const existing = await UsersAPI.getModuleAccessMappings();
    if (modules?.length) existing[userId] = modules; else delete existing[userId];
    await handleResponse(() => supabase.from("global_settings").upsert({ key: "user_module_access", value: JSON.stringify(existing) }, { onConflict: 'key' }));
    return true;
  }
};
