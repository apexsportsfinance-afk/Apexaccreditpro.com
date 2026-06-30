import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { UsersAPI } from "../lib/storage";
import { supabase } from "../lib/supabase";
import {
  hasPermission as hasPermissionPure,
  canAccessEvent as canAccessEventPure,
  canAccessModule as canAccessModulePure,
  hasExactModuleAccess as hasExactModuleAccessPure,
} from "../lib/permissions";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

// Org-level feature gate. `features` is the org's jsonb map of enabled module
// paths, e.g. { "/admin/qr-system": true, "/admin/medals": false }. Returns true
// if `path` is covered by an enabled entry (exact / parent / child match, same
// semantics as canAccessModule). MIGRATION-SAFE: an org with no "/admin" module
// keys (null / legacy 14-key format / empty) is treated as unrestricted, so
// existing clients aren't locked out until features are explicitly configured.
function orgAllowsModule(features, path) {
  if (!features || typeof features !== "object") return true;
  const moduleKeys = Object.keys(features).filter((k) => k.startsWith("/admin"));
  if (moduleKeys.length === 0) return true;
  return moduleKeys.some(
    (k) => features[k] && (path === k || path.startsWith(k + "/") || k.startsWith(path + "/"))
  );
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const fetchedProfileForRef = useRef(null);
  const mountedRef = useRef(true);

  const getSafeUserFromSession = (sessionUser) => ({
    id: sessionUser.id,
    email: sessionUser.email,
    name:
      sessionUser.user_metadata?.full_name ||
      sessionUser.user_metadata?.name ||
      sessionUser.email,
    role: sessionUser.user_metadata?.role || "event_admin",
    // Org-feature gating context — optimistic defaults (unrestricted) until the
    // background profile load resolves the real values, so platform users never
    // flash an empty sidebar. A real client gets isPlatform=false + their org's
    // features once loaded.
    isPlatform: true,
    orgFeatures: null
  });

  const upgradeProfileRole = async (sessionUser) => {
    if (fetchedProfileForRef.current === sessionUser.id) return;
    fetchedProfileForRef.current = sessionUser.id;

    try {
      // Fetch profile, access mappings, and team assignments in parallel for speed
      const [profileRes, accessMapping, moduleMapping, teamAssignments, accessCtxRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("role, full_name")
          .eq("id", sessionUser.id)
          .single(),
        UsersAPI.getAccessMappings(),
        UsersAPI.getModuleAccessMappings(),
        supabase
          .from("team_users")
          .select("team_id")
          .eq("user_id", sessionUser.id),
        // Org-level feature context (platform flag + the user's org features).
        supabase.rpc("my_access_context")
      ]);

      if (!mountedRef.current) return;

      const { data, error } = profileRes;

      // Update user state with both profile info and allowed events
      setUser((current) => {
        if (!current) return current;
        return {
          ...current,
          name: data?.full_name || current.name,
          role: data?.role || current.role,
          allowedEventIds: accessMapping[sessionUser.id] || [],
          allowedModules: moduleMapping[sessionUser.id] || [],
          hasTeamAccess: (teamAssignments.data?.length || 0) > 0,
          // Org-feature gating: platform users (super_admin / Apex staff) stay
          // unrestricted; a client is limited to its org's features. Default to
          // unrestricted on any error so we never lock people out by accident.
          isPlatform: accessCtxRes?.data?.is_platform ?? true,
          orgFeatures: accessCtxRes?.data?.features ?? null
        };
      });

      if (error && mountedRef.current) {
        console.warn("Profile fetch error, using defaults.");
      }
    } catch (err) {
      console.warn("Background auth enhancement failed:", err);
    } finally {
      if (mountedRef.current) setProfileLoaded(true);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
 
    const initAuth = async () => {
      try {
        const {
          data: { session }
        } = await supabase.auth.getSession();
 
        if (!mountedRef.current) return;
 
        if (session?.user) {
          const safeUser = getSafeUserFromSession(session.user);
          setUser(safeUser);
          // Fire background enhancement (async)
          setProfileLoaded(false);
          upgradeProfileRole(session.user);
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };
 
    initAuth();
 
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mountedRef.current) return;
 
      if (session?.user) {
        const isNewUser = fetchedProfileForRef.current !== session.user.id;
 
        if (isNewUser) {
          const safeUser = getSafeUserFromSession(session.user);
          setUser(safeUser);
          setProfileLoaded(false);
          upgradeProfileRole(session.user);
        }
      } else {
        setUser(null);
        fetchedProfileForRef.current = null;
        setProfileLoaded(false);
      }
 
      if (mountedRef.current) setLoading(false);
    });
 
    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    try {
      const authenticatedUser = await UsersAPI.authenticate(email, password);
      if (authenticatedUser) {
        return { success: true };
      }
      return { success: false, error: "Invalid email or password" };
    } catch (err) {
      console.error("Login error:", err);
      if (
        err?.message?.includes("Failed to fetch") ||
        err?.name === "TypeError" ||
        err?.name === "AbortError"
      ) {
        return { success: false, error: "Network error. Please check your connection and try again." };
      }
      return { success: false, error: "An error occurred. Please try again." };
    }
  };

  const logout = async () => {
    try {
      await UsersAPI.logout();
    } catch (err) {
      console.warn("Logout error:", err);
    } finally {
      setUser(null);
      fetchedProfileForRef.current = null;
      if (typeof window !== 'undefined') {
        window.location.href = '/login'; // Force a full clean state on logout
      }
    }
  };

  // Authorization logic lives in src/lib/permissions.js (pure + unit-tested).
  // These wrappers just bind the current user's state to those functions.
  const hasPermission = (permission) =>
    user ? hasPermissionPure(user.role, permission) : false;

  const canAccessEvent = (eventId) =>
    user ? canAccessEventPure(user.role, user.allowedEventIds, eventId) : false;

  const canAccessModule = (path) => {
    if (!user) return false;
    // Org-level feature gate: a client (non-platform) user only sees pages their
    // org enabled — even a client 'admin'. Platform users (super_admin / Apex
    // staff) bypass this. Orgs with no module config stay unrestricted.
    if (!user.isPlatform && !orgAllowsModule(user.orgFeatures, path)) return false;
    return canAccessModulePure(user.role, user.allowedModules, user.hasTeamAccess, path);
  };

  const hasExactModuleAccess = (path) =>
    user ? hasExactModuleAccessPure(user.role, user.allowedModules, path) : false;

  const value = {
    user,
    loading,
    profileLoaded,
    login,
    logout,
    hasPermission,
    canAccessEvent,
    canAccessModule,
    hasExactModuleAccess,
    isAuthenticated: !!user,
    isSuperAdmin: user?.role === "super_admin" || user?.role === "admin",
    isEventAdmin: user?.role === "event_admin",
    isViewer: user?.role === "viewer"
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
