import React from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, ScanLine, Search, Settings } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../lib/utils";

export default function StaffLayout() {
  const location = useLocation();

  const navItems = [
    { name: "Dashboard", path: "/staff/dashboard", icon: LayoutDashboard },
    { name: "Scan", path: "/scanner?mode=attendance&source=staff", icon: ScanLine },
    { name: "Search", path: "/staff/search", icon: Search },
    { name: "Settings", path: "/staff/settings", icon: Settings },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#050b18] text-slate-200 font-inter max-w-md mx-auto relative border-x border-white/5 shadow-2xl overflow-hidden">
      {/* Top Header */}
      <header className="flex-none bg-[#0a1120]/80 backdrop-blur-md border-b border-white/5 py-4 px-6 z-20">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-xl font-black text-white uppercase tracking-tighter">
              Apex Staff
            </h1>
            <p className="text-[10px] text-emerald-400 font-black uppercase tracking-widest">
              Operations Active
            </p>
          </div>
          <div className="h-10 w-10 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto relative z-10 pb-20">
        <div className="h-full">
          <Outlet />
        </div>
      </main>

      {/* Bottom Tab Navigation */}
      <nav className="flex-none bg-[#0a1120] border-t border-white/10 z-50 fixed bottom-0 w-full max-w-md mx-auto shadow-lg">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            // Check if active. For scan, we just make it an external-like link, but it's part of the app.
            const isActive = location.pathname.startsWith(item.path.split('?')[0]);
            const isScan = item.name === "Scan";

            return (
              <NavLink
                key={item.name}
                to={item.path}
                className={cn(
                  "relative flex flex-col items-center justify-center w-16 h-14 rounded-2xl transition-all duration-300",
                  isActive ? "text-cyan-400" : "text-slate-500 hover:text-slate-300"
                )}
              >
                {/* Scan Button gets special styling */}
                {isScan ? (
                  <div className="absolute -top-6 w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)] border-4 border-[#050b18] text-white">
                    <Icon className="w-6 h-6" />
                  </div>
                ) : (
                  <>
                    <Icon className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">
                      {item.name}
                    </span>
                    {isActive && !isScan && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute -bottom-2 w-8 h-1 bg-cyan-400 rounded-full"
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      />
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
