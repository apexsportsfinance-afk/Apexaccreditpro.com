import React, { useState } from "react";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";

export default function Tabs({ 
  tabs, 
  defaultTab, 
  onChange,
  className 
}) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.value);

  const handleTabChange = (value) => {
    setActiveTab(value);
    onChange?.(value);
  };

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex gap-1 p-1 bg-slate-800/50 rounded-xl">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleTabChange(tab.value)}
            className={cn(
              "relative flex-1 px-4 py-2.5 text-lg font-medium rounded-lg transition-colors",
              activeTab === tab.value
                ? "text-white"
                : "text-slate-400 hover:text-slate-300"
            )}
          >
            {activeTab === tab.value && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-primary-600 rounded-lg"
                transition={{ duration: 0.2 }}
              />
            )}
            <span className="relative z-10 flex items-center justify-center gap-2">
              {tab.icon && <tab.icon className="w-4 h-4" />}
              {tab.label}
            </span>
          </button>
        ))}
      </div>
      <div>
        {tabs.find((t) => t.value === activeTab)?.content}
      </div>
    </div>
  );
}
