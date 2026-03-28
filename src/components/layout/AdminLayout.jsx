import React, { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import { useAuth } from "../../contexts/AuthContext";

export default function AdminLayout() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, loading, navigate]);

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
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary-500/5 rounded-full blur-[140px] opacity-20" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary-600/5 rounded-full blur-[140px] opacity-20" />
      </div>

      <Sidebar />
      
      <main className="ml-20 lg:ml-[280px] min-h-screen transition-all duration-300 relative z-10">
        <div className="p-lg lg:p-xl max-w-[1600px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
