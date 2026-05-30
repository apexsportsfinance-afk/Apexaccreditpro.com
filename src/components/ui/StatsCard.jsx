import React from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

export function StatsCard({
  title,
  value,
  icon: Icon,
  iconColor = "text-primary-400",
  change,
  changeType = "neutral",
  className,
  data = [40, 70, 55, 90, 75, 100, 85, 95, 110]
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "apex-glass p-6 relative overflow-hidden group hover:border-primary/30 transition-all duration-500",
        className
      )}
    >
      <div className="flex items-start justify-between relative z-10 w-full font-body">
        <div>
          <p className="font-h2 text-slate-400 mb-1.5 uppercase tracking-widest font-bold tracking-wider">{title}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-black text-main leading-none mb-3 tracking-tighter drop-shadow-sm">{value}</p>
          </div>
          {change && (
            <p className={cn(
              "text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md inline-block transition-all",
              changeType === "positive" && "bg-success/15 text-success border border-success/20",
              changeType === "negative" && "bg-critical/15 text-critical border border-critical/20",
              changeType === "neutral" && "bg-white/10 text-main/80 border border-white/10"
            )}>
              {change}
            </p>
          )}
        </div>

        {Icon && (
          <div className={cn(
            "p-3.5 rounded-2xl bg-base-alt border border-border shadow-xl relative overflow-hidden group-hover:scale-110 transition-all duration-500",
            iconColor.includes("primary") || iconColor.includes("blue") ? "shadow-primary/5 shadow-inner" : "shadow-black/5"
          )}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
            <Icon className={cn("w-6 h-6 relative z-10", iconColor)} />
          </div>
        )}

      </div>
      {data && data.length > 0 && (
        <div className="mt-8 flex items-end gap-1.5 h-12 opacity-80 group-hover:opacity-100 transition-all duration-700 px-1">
          {data.map((h, i) => (
            <div key={i} className="relative flex-1 group/bar" style={{ height: `${Math.max(10, Math.min(h, 100))}%` }}>
              {/* Elite 3D Glass Bar */}
              <div className="absolute inset-x-0 bottom-0 h-full transition-all duration-700 cubic-bezier(0.4, 0, 0.2, 1) group-hover:scale-y-110 origin-bottom">
                {/* Main Front Face */}
                <div className="absolute inset-0 rounded-sm z-10 border-t border-l border-white/20 bg-gradient-to-tr from-primary/40 to-primary/10 backdrop-blur-xs" />
                
                {/* Top Highlight */}
                <div className="absolute -top-[2px] left-[1px] right-[-1px] h-[2px] -skew-x-[45deg] z-20 rounded-t-sm bg-primary/60 border-t border-white/30" />
                
                {/* Side Shadow */}
                <div className="absolute top-[1px] -right-[2px] bottom-[-1px] w-[2px] -skew-y-[45deg] z-0 rounded-r-sm bg-black/40 border-r border-white/5" />
              </div>
              
              {/* Ambient Glow */}
              <div className="absolute -bottom-1 inset-x-0 h-1 blur-lg bg-primary/30 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default StatsCard;
