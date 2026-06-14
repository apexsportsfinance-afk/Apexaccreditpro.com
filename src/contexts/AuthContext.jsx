import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { UsersAPI } from "../lib/storage";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

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
    role: sessionUser.user_metadata?.role || "event_admin"
  });

  const upgradeProfileRole = async (sessionUser) => {
    if (fetchedProfileForRef.current === sessionUser.id) return;
    fetchedProfileForRef.current = sessionUser.id;

    try {
      // Fetch profile, access mappings, and team assignments in parallel for speed
      const [profileRes, accessMapping, moduleMapping, teamAssignments] = await Promise.all([
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
          .eq("user_id", sessionUser.id)
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
          hasTeamAccess: (teamAssignments.data?.length || 0) > 0
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

  const hasPermission = (permission) => {
    if (!user) return false;
    const permissions = {
      super_admin: ["all"],
      admin: ["all"],
      event_admin: ["view_events", "manage_accreditations", "view_reports"],
      viewer: ["view_events", "view_accreditations"]
    };
    const userPermissions = permissions[user.role] || [];
    return (
      userPermissions.includes("all") || userPermissions.includes(permission)
    );
  };

  const canAccessEvent = (eventId) => {
    if (!user) return false;
    if (user.role === "super_admin" || user.role === "admin") return true;
    if (!user.allowedEventIds) return false;
    return user.allowedEventIds.includes(eventId);
  };

  const canAccessModule = (path) => {
    if (!user) return false;
    if (user.role === "super_admin" || user.role === "admin") return true;

    // Team Portal is only relevant once an admin has assigned the user to a team
    // (it has its own API-level security and RLS checks beyond this)
    if (path.startsWith("/portal/teams")) return !!user.hasTeamAccess;

    if (!user.allowedModules) return false;
    
    // Exact match, parent match, or child match
    return user.allowedModules.some(modulePath => {
      if (path === modulePath || path.startsWith(modulePath + "/") || modulePath.startsWith(path + "/")) {
        return true;
      }

      // Special case for dynamic event routes like /admin/events/:id
      if (modulePath.startsWith("/admin/events/") && path.startsWith("/admin/events/")) {
        const pathParts = path.split("/"); // e.g. ["", "admin", "events", "uuid", "subpage?"]
        const modParts = modulePath.split("/"); // e.g. ["", "admin", "events", "audit-log"]
        
        // Allow access to the event detail wrapper
        if (pathParts.length === 4) return true;
        
        // Allow access to the specific granular subpage
        if (pathParts.length === 5 && pathParts[4] === modParts[3]) {
          return true;
        }
      }
      
      return false;
    });
  };

  const hasExactModuleAccess = (path) => {
    if (!user) return false;
    if (user.role === "super_admin" || user.role === "admin") return true;
    if (!user.allowedModules) return false;
    
    // Must exactly match or be a parent of the path
    return user.allowedModules.some(modulePath => 
      path === modulePath || path.startsWith(modulePath + "/")
    );
  };

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
