import React, { useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useAuth } from "../../contexts/AuthContext";
import BackgroundProgress from "../accreditation/BackgroundProgress";

export default function AdminLayout() {
  const { isAuthenticated, loading, isSuperAdmin, canAccessModule } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        navigate("/login");
      } else {
        // Protect routes based on module permissions
        if (!canAccessModule(location.pathname)) {
          // If dashboard is available, go there, otherwise find first accessible module
          navigate("/admin/dashboard");
        }
      }
    }
  }, [isAuthenticated, loading, navigate, isSuperAdmin, location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-swim-deep via-primary-900 to-ocean-900 flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-2 border-primary-400 border-t-transparent rounded-full shadow-lg shadow-primary-500/30" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-base relative overflow-hidden font-body">
      {/* Design System Ambient Background Glow */}
      <div className="absolute inset-0 pointer-events-none transition-opacity duration-500">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary-500/5 dark:bg-primary-500/10 rounded-full blur-[140px] opacity-20 dark:opacity-30" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary-600/5 dark:bg-primary-600/10 rounded-full blur-[140px] opacity-20 dark:opacity-30" />
      </div>

      <Sidebar />
      
      <main className="ml-20 lg:ml-[280px] min-h-screen transition-all duration-300 relative z-10">
        <div className="p-lg lg:p-xl max-w-[1600px] mx-auto">
          <BackgroundProgress />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
