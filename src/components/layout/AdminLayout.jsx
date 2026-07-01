import React, { useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import Sidebar, { navItems } from "./Sidebar";
import { useAuth } from "../../contexts/AuthContext";
import BackgroundProgress from "../accreditation/BackgroundProgress";
import { ErrorBoundary } from "./ErrorBoundary";

export default function AdminLayout() {
  const { isAuthenticated, loading, profileLoaded, isSuperAdmin, canAccessModule, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        navigate("/login");
      } else if (profileLoaded) {
        // Protect routes based on module permissions
        // (wait for profileLoaded so we don't redirect away before
        // allowedModules/team assignments have finished loading).
        // Mirror Sidebar's gating: platformOnly/superOnly nav items are role-gated
        // on top of canAccessModule, which fails open for a client 'admin' on the
        // platform-owner-only pages (Settings/Audit/Integrations/API docs). Without
        // this, those pages are reachable by direct URL even though the nav hides them.
        const canSeeNavItem = (item) => {
          if (item.platformOnly && user?.role !== "super_admin") return false;
          if (item.superOnly && !isSuperAdmin) return false;
          return canAccessModule(item.to);
        };
        // Keep the original per-pathname canAccessModule check (preserves dynamic
        // event sub-route matching); only ADD a role-based denial when the current
        // path belongs to a restricted nav item the user isn't allowed to see.
        const currentItem = navItems.find(
          item => location.pathname === item.to || location.pathname.startsWith(item.to + "/")
        );
        const roleBlocked = currentItem && (
          (currentItem.platformOnly && user?.role !== "super_admin") ||
          (currentItem.superOnly && !isSuperAdmin)
        );

        if (roleBlocked || !canAccessModule(location.pathname)) {
          // APX-Fix: Find first authorized module instead of always defaulting to dashboard
          const firstAllowed = navItems.find(canSeeNavItem);

          if (firstAllowed) {
            navigate(firstAllowed.to);
          } else if (location.pathname !== "/admin/dashboard") {
            // Ultimate fallback
            navigate("/admin/dashboard");
          }
        }
      }
    }
  }, [isAuthenticated, loading, profileLoaded, navigate, isSuperAdmin, location.pathname, user?.allowedModules, user?.hasTeamAccess]);

  if (loading) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center relative overflow-hidden">
        {/* Modern high-end golden ambient blur behind loader */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-primary/10 rounded-full blur-[80px]" />
        <div className="animate-spin w-10 h-10 border-2 border-primary border-t-transparent rounded-full shadow-lg shadow-primary/20 relative z-10" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-base relative overflow-hidden font-body">
      {/* Design System Ambient Background Glow - Optimized */}
      <div className="absolute inset-0 pointer-events-none transition-opacity duration-700">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary-500/5 dark:bg-primary-500/10 rounded-full blur-[100px] opacity-10 dark:opacity-20" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-primary-600/5 dark:bg-primary-600/10 rounded-full blur-[100px] opacity-10 dark:opacity-20" />
      </div>

      <Sidebar />
      
      <main className="ml-20 lg:ml-[280px] min-h-screen transition-[margin] duration-300 relative z-10">
        <div className="p-lg lg:p-xl max-w-[1600px] mx-auto">
          <BackgroundProgress />
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
