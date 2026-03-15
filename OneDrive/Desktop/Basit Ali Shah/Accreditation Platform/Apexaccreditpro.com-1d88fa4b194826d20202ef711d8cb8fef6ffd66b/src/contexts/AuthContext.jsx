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
      const { data, error } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", sessionUser.id)
        .single();

      if (!mountedRef.current) return;

      if (!error && data) {
        setUser((current) => {
          if (!current) return current;
          return {
            ...current,
            name: data.full_name || current.name,
            role: data.role || current.role
          };
        });
        return;
      }

      if (error && mountedRef.current) {
        await new Promise((r) => setTimeout(r, 3000));
        if (!mountedRef.current) return;
        const retry = await supabase
          .from("profiles")
          .select("role, full_name")
          .eq("id", sessionUser.id)
          .single();
        if (!mountedRef.current) return;
        if (!retry.error && retry.data) {
          setUser((current) => {
            if (!current) return current;
            return {
              ...current,
              name: retry.data.full_name || current.name,
              role: retry.data.role || current.role
            };
          });
        }
      }
    } catch (err) {
      if (
        err?.name === "AbortError" ||
        err?.message?.includes("signal is aborted") ||
        err?.message?.includes("Failed to fetch")
      ) {
        await new Promise((r) => setTimeout(r, 3000));
        if (!mountedRef.current) return;
        try {
          const retry = await supabase
            .from("profiles")
            .select("role, full_name")
            .eq("id", sessionUser.id)
            .single();
          if (!mountedRef.current) return;
          if (!retry.error && retry.data) {
            setUser((current) => {
              if (!current) return current;
              return {
                ...current,
                name: retry.data.full_name || current.name,
                role: retry.data.role || current.role
              };
            });
          }
        } catch (_) {
          // Retry also failed — user stays with metadata role
        }
        return;
      }
      console.warn("Background profile fetch failed:", err);
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
          setUser(getSafeUserFromSession(session.user));
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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mountedRef.current) return;

      if (session?.user) {
        const isNewUser = fetchedProfileForRef.current !== session.user.id;

        if (isNewUser) {
          fetchedProfileForRef.current = null;
          setUser(getSafeUserFromSession(session.user));
          upgradeProfileRole(session.user);
        }
      } else {
        setUser(null);
        fetchedProfileForRef.current = null;
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
