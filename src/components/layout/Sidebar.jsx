import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  LayoutDashboard,
  Users,
  Calendar,
  MapPin,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Waves,
  ClipboardList,
  FileText
} from "lucide-react";
import { cn } from "../../lib/utils";
import { useAuth } from "../../contexts/AuthContext";

const navigation = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Accreditations", href: "/admin/accreditations", icon: ClipboardList },
  { name: "Events", href: "/admin/events", icon: Calendar },
  { name: "Zones", href: "/admin/zones", icon: MapPin },
  { name: "Users", href: "/admin/users", icon: Users },
  { name: "Audit Log", href: "/admin/audit", icon: FileText, adminOnly: true },
  { name: "Settings", href: "/admin/settings", icon: Settings }
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout, isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const filteredNav = navigation.filter(
    (item) => !item.adminOnly || isSuperAdmin
  );

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 80 : 280 }}
      className="fixed left-0 top-0 h-screen bg-gradient-to-b from-swim-deep via-primary-950 to-ocean-950 border-r border-primary-500/20 z-40 flex flex-col shadow-2xl shadow-primary-900/30"
    >
      <div className="flex items-center justify-between p-4 border-b border-primary-500/20 bg-gradient-to-r from-primary-900/30 to-transparent">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 via-ocean-500 to-aqua-500 flex items-center justify-center shadow-lg shadow-primary-500/40 animate-pulse">
                <Waves className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">ApexAccreditation</h1>
                <p className="text-lg text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-ocean-400">Professional Platform</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg hover:bg-primary-500/20 transition-colors border border-transparent hover:border-primary-500/30"
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5 text-primary-400" />
          ) : (
            <ChevronLeft className="w-5 h-5 text-primary-400" />
          )}
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {filteredNav.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            end={item.href === "/admin"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200",
                isActive
                  ? "bg-gradient-to-r from-primary-500 via-ocean-500 to-aqua-600 text-white shadow-lg shadow-primary-500/40"
                  : "text-primary-200/70 hover:text-white hover:bg-primary-500/20 hover:border-primary-500/30 border border-transparent"
              )
            }
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            <AnimatePresence mode="wait">
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-lg font-medium"
                >
                  {item.name}
                </motion.span>
              )}
            </AnimatePresence>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-primary-500/20 bg-gradient-to-t from-primary-950/50 to-transparent">
        <div className={cn(
          "flex items-center gap-3 mb-4",
          collapsed ? "justify-center" : ""
        )}>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 via-ocean-500 to-aqua-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/30">
            <span className="text-lg font-bold text-white">
              {user?.name?.charAt(0) || "U"}
            </span>
          </div>
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 min-w-0"
              >
                <p className="text-lg font-medium text-white truncate">
                  {user?.name}
                </p>
                <p className="text-lg text-primary-400 truncate">
                  {user?.role?.replace("_", " ")}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button
          onClick={handleLogout}
          className={cn(
            "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors",
            collapsed ? "justify-center" : ""
          )}
        >
          <LogOut className="w-5 h-5" />
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-lg font-medium"
              >
                Logout
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );
}