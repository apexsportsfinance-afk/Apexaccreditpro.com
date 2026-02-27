import React, { createContext, useContext, useState, useEffect } from "react";
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

  // Helper to construct a safe user object immediately from session
  const getSafeUserFromSession = (sessionUser) => ({
    id: sessionUser.id,
    email: sessionUser.email,
    name: sessionUser.user_metadata?.full_name || sessionUser.user_metadata?.name || sessionUser.email,
    role: sessionUser.user_metadata?.role || "event_admin" // Default safe role until DB confirms
  });

  const upgradeProfileRole = async (sessionUser) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", sessionUser.id)
        .single();

      if (!error && data) {
        // Upgrade the user state with DB data
        setUser((current) => ({
          ...current,
          name: data.full_name || current?.name,
          role: data.role || current?.role
        }));
      }
    } catch (err) {
      console.warn("Background profile fetch failed:", err);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // 1. OPTIMISTIC UPDATE: Log user in IMMEDIATELY
          const safeUser = getSafeUserFromSession(session.user);
          setUser(safeUser);
          // 2. BACKGROUND FETCH: Upgrade with real DB data
          upgradeProfileRole(session.user);
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          // Optimistic update for speedy transition
          setUser((prev) => prev?.id === session.user.id ? prev : getSafeUserFromSession(session.user));
          // Background refresh
          upgradeProfileRole(session.user);
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email, password) => {
    const authenticatedUser = await UsersAPI.authenticate(email, password);
    if (authenticatedUser) {
      return { success: true };
    }
    return { success: false, error: "Invalid email or password" };
  };

  const logout = async () => {
    await UsersAPI.logout();
    setUser(null);
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    // Map both 'admin' and 'super_admin' to super admin privileges
    const permissions = {
      super_admin: ["all"],
      admin: ["all"],
      event_admin: ["view_events", "manage_accreditations", "view_reports"],
      viewer: ["view_events", "view_accreditations"]
    };
    const userPermissions = permissions[user.role] || [];
    return userPermissions.includes("all") || userPermissions.includes(permission);
  };

  const value = {
    user,
    loading,
    login,
    logout,
    hasPermission,
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
