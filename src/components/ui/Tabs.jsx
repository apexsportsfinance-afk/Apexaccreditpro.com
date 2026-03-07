import React from "react";
import { cn } from "../../lib/utils";

export function Tabs({ tabs = [], activeTab, onTabChange, className }) {
  return (
    <div className={cn("flex gap-1 bg-slate-800/50 p-1 rounded-xl border border-slate-700/50", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-lg font-medium transition-all duration-200",
            activeTab === tab.id
              ? "bg-gradient-to-r from-primary-600 to-ocean-600 text-white shadow-lg shadow-primary-900/30"
              : "text-slate-400 hover:text-white hover:bg-slate-700/50"
          )}
        >
          {tab.icon && <tab.icon className="w-4 h-4" />}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default Tabs;
