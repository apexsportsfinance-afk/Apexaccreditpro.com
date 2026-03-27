import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Settings,
  ClipboardList,
  Map,
  QrCode,
  Waves,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Radio,
  Ticket,
  History
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { cn } from "../../lib/utils";

const navItems = [
  { to: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/events", icon: Calendar, label: "Events" },
  { to: "/admin/ticketing", icon: Ticket, label: "Spectator Portal" },
  { to: "/admin/accreditations", icon: ClipboardList, label: "Accreditations" },
  { to: "/admin/zones", icon: Map, label: "Zones" },
  { to: "/admin/qr-system", icon: QrCode, label: "QR System" },
  { to: "/admin/broadcasts", icon: Radio, label: "Broadcast History" },
  { to: "/admin/users", icon: Users, label: "Users" },
  { to: "/admin/audit", icon: History, label: "Audit Log" },
  { to: "/admin/settings", icon: Settings, label: "Settings" }
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      id="admin_sidebar"
      className={cn(
        "fixed left-0 top-0 h-full flex flex-col glass-card border-r transition-all duration-300 z-40",
        collapsed ? "w-20" : "w-[280px]"
      )}
    >
      <div className="flex items-center gap-3 px-6 border-b border-slate-800/60 z-10 relative bg-slate-950/50 min-h-[76px]">
        {!collapsed ? (
          <div className="flex-1 flex items-center justify-start overflow-hidden">
            <img 
              src="/apex-logo.png" 
              alt="Apex Sports Academy" 
              className="w-full max-w-[170px] h-auto object-contain object-left brightness-0 invert opacity-95 transition-all duration-300 hover:opacity-100" 
            />
          </div>
        ) : (
          <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center overflow-hidden">
            <img 
              src="/apex-logo.png" 
              alt="Apex" 
              className="w-full h-auto object-cover object-[15%] brightness-0 invert opacity-90 transition-all duration-300 hover:opacity-100" 
            />
          </div>
        )}
        <button
          onClick={() => setCollapsed(prev => !prev)}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors flex-shrink-0 bg-slate-900/50"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto pt-0 pb-4 space-y-1 px-3">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                isActive
                  ? "bg-primary-500/20 text-primary-300 border border-primary-500/30 shadow-sm shadow-primary-500/10"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/60"
              }`
            }
            title={collapsed ? label : undefined}
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={`w-5 h-5 flex-shrink-0 transition-colors ${
                    isActive ? "text-primary-400" : "text-slate-500 group-hover:text-white"
                  }`}
                />
                {!collapsed && (
                  <span className="text-lg font-extralight truncate">{label}</span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-slate-800/60 p-3">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-600 to-ocean-600 flex items-center justify-center flex-shrink-0">
              <span className="text-lg font-medium text-white">
                {user?.email?.[0]?.toUpperCase() || "A"}
              </span>
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-lg text-white font-extralight truncate">
                {user?.email || "Admin"}
              </p>
            </div>
            {logout && (
              <button
                onClick={logout}
                className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-600 to-ocean-600 flex items-center justify-center">
              <span className="text-lg font-medium text-white">
                {user?.email?.[0]?.toUpperCase() || "A"}
              </span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
