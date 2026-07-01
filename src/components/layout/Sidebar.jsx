import React, { useState, memo } from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Calendar,
  Users,
  Settings,
  ClipboardList,
  Map,
  QrCode,
  Smartphone,
  Waves,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Radio,
  Ticket,
  History,
  RefreshCw,
  Trophy,
  MessageSquare,
  Book,
  Shield,
  BookOpen,
  MonitorPlay,
  Building2
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useBranding } from "../../contexts/BrandingContext";
import ThemeToggle from "../ui/ThemeToggle";
import { cn } from "../../lib/utils";

export const navItems = [
  { to: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/events", icon: Calendar, label: "Events" },
  { to: "/admin/teams", icon: Shield, label: "Admin Teams" },
  { to: "/admin/rules", icon: BookOpen, label: "Rules & Regulations" },
  { to: "/portal/teams", icon: Users, label: "Team Portal" },
  { to: "/admin/ticketing", icon: Ticket, label: "Spectator Portal" },
  { to: "/admin/accreditations", icon: ClipboardList, label: "Accreditations" },
  { to: "/admin/zones", icon: Map, label: "Zones" },
  { to: "/admin/qr-system", icon: QrCode, label: "QR System" },
  { to: "/admin/broadcasts", icon: Radio, label: "Broadcast History" },
  { to: "/admin/medals", icon: Trophy, label: "Medal Rankings" },
  { to: "/admin/call-room", icon: MonitorPlay, label: "Call Room Display" },
  { to: "/admin/feedback", icon: MessageSquare, label: "Feedback" },
  { to: "/admin/organizations", icon: Building2, label: "Organizations", platformOnly: true },
  // Platform-owner-only tools. Must be platformOnly (strict super_admin), NOT
  // superOnly: a client login is role 'admin', which isSuperAdmin also covers,
  // and the org-feature gate fails open for paths it doesn't model (these are
  // deliberately excluded from Organizations' FEATURE_TREE) — so superOnly would
  // leak them into client sidebars. Users stays superOnly: it's org-grantable.
  { to: "/admin/partners", icon: Settings, label: "Integrations", platformOnly: true },
  { to: "/admin/api-docs", icon: Book, label: "API Documentation", platformOnly: true },
  { to: "/admin/users", icon: Users, label: "Users", superOnly: true },
  { to: "/admin/audit", icon: History, label: "Audit Log", platformOnly: true },
  { to: "/admin/settings", icon: Settings, label: "Settings", platformOnly: true }
];

const Sidebar = memo(function Sidebar() {
  const { user, logout, isSuperAdmin, isViewer, canAccessModule } = useAuth();
  const branding = useBranding();
  // Apex default keeps the original asset + the dark-mode monochrome treatment.
  // A real tenant uses its own logo (or name) and skips the invert filter, which
  // is tuned for Apex's mono logo and would wreck a coloured org logo.
  // Show an image for Apex (its logo asset) or a tenant that uploaded one;
  // otherwise show the org's name/monogram as text in its brand colour so a
  // logo-less tenant never falls back to the Apex logo.
  const hasLogoImage = branding.isApex || !!branding.logoUrl;
  const logoSrc = branding.isApex ? "/apex-logo.png" : branding.logoUrl;
  const logoAlt = branding.isApex ? "Apex Sports Academy" : branding.name;
  const monoFilter = branding.isApex ? "dark:brightness-0 dark:invert" : "";
  const [collapsed, setCollapsed] = useState(false);
  
  const filteredNavItems = navItems.filter(item => {
    // Platform-owner-only items (e.g. Organizations) — strictly super_admin,
    // never the broader "admin" that isSuperAdmin also covers (clients are admin).
    if (item.platformOnly && user?.role !== "super_admin") return false;

    // If it's a superOnly item, check isSuperAdmin
    if (item.superOnly && !isSuperAdmin) return false;

    // Check module permission
    return canAccessModule(item.to);
  });

  return (
    <aside
      id="admin_sidebar"
      className={cn(
        "fixed left-0 top-0 h-full flex flex-col bg-base border-r border-border transition-all duration-300 z-40 shadow-2xl",
        collapsed ? "w-20" : "w-[280px]"
      )}
    >
      <div className="flex items-center gap-3 px-6 border-b border-border z-10 relative bg-base/50 backdrop-blur-md min-h-[76px]">
        {!collapsed ? (
          <div className="flex-1 flex items-center justify-start overflow-hidden">
            {hasLogoImage ? (
              <img
                src={logoSrc}
                alt={logoAlt}
                className={cn("w-full max-w-[170px] h-auto object-contain object-left opacity-95 transition-all duration-300 hover:opacity-100", monoFilter)}
              />
            ) : (
              <span className="text-xl font-extrabold tracking-wide truncate" style={{ color: branding.brandPrimary }}>{branding.name}</span>
            )}
          </div>
        ) : (
          <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center overflow-hidden">
            {hasLogoImage ? (
              <img
                src={logoSrc}
                alt={branding.isApex ? "Apex" : branding.name}
                className={cn("w-full h-auto object-cover object-[15%] opacity-90 transition-all duration-300 hover:opacity-100", monoFilter)}
              />
            ) : (
              <span className="text-lg font-black" style={{ color: branding.brandPrimary }}>{branding.logoText}</span>
            )}
          </div>
        )}
        <button
          onClick={() => setCollapsed(prev => !prev)}
          className="p-1.5 rounded-lg hover:bg-primary-500/10 text-muted hover:text-primary-500 transition-all duration-200 flex-shrink-0 bg-base-alt border border-border"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto pt-4 pb-4 space-y-1 px-3">
        {filteredNavItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                isActive
                  ? "bg-primary-500/10 text-primary-600 dark:text-primary border border-primary-500/20 shadow-sm"
                  : "text-muted hover:text-main hover:bg-base-alt"
              }`
            }
            title={collapsed ? label : undefined}
          >
            {({ isActive }) => (
              <>
                <Icon
                  className={`w-5 h-5 flex-shrink-0 transition-colors ${
                    isActive ? "text-primary-600 dark:text-primary" : "text-muted group-hover:text-main"
                  }`}
                />
                {!collapsed && (
                  <span className="text-sm font-medium truncate tracking-wide">{label}</span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border p-3 bg-base/50 backdrop-blur-md space-y-2">
        <div className={cn("flex items-center gap-2", collapsed ? "flex-col" : "justify-between px-1 mb-1")}>
          <ThemeToggle className="w-full" />
          {!collapsed && (
            <button
              onClick={() => window.location.reload()}
              className="p-2 rounded-xl text-muted hover:text-primary-500 hover:bg-base-alt border border-transparent hover:border-border transition-all"
              title="Refresh Application"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          )}
        </div>

        {!collapsed ? (
          <div className="flex items-center gap-3 pt-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/20">
              <span className="text-xs font-bold text-white">
                {user?.email?.[0]?.toUpperCase() || "A"}
              </span>
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs text-main font-medium truncate">
                {user?.email || "Admin"}
              </p>
            </div>
            {logout && (
              <button
                onClick={logout}
                className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted hover:text-red-400 transition-colors flex-shrink-0"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex justify-center pt-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
              <span className="text-xs font-bold text-white">
                {user?.email?.[0]?.toUpperCase() || "A"}
              </span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
});

export default Sidebar;
