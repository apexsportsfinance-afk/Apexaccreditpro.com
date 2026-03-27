import React from "react";
import { motion } from "motion/react";
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
        "glass-card rounded-2xl p-6 relative overflow-hidden group",
        className
      )}
    >
      <div className="flex items-start justify-between relative z-10 w-full">
        <div>
          <p className="text-lg text-slate-400 font-extralight mb-1">{title}</p>
          <p className="text-4xl font-bold text-white tracking-tight leading-none mb-3">{value}</p>
          {change && (
            <p className={cn(
              "text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg inline-block shadow-sm",
              changeType === "positive" && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
              changeType === "negative" && "bg-red-500/10 text-red-400 border border-red-500/20",
              changeType === "neutral" && "bg-slate-500/10 text-slate-500 border border-slate-500/20"
            )}>
              {change}
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn(
            "p-3 rounded-2xl bg-gradient-to-br from-primary-500/10 to-transparent border border-primary-500/20 shadow-lg relative overflow-hidden group-hover:scale-110 transition-transform duration-500",
            iconColor.includes("blue") && "shadow-blue-500/10",
            iconColor.includes("purple") && "shadow-purple-500/10",
            iconColor.includes("amber") && "shadow-amber-500/10",
            iconColor.includes("emerald") && "shadow-emerald-500/10",
            iconColor.includes("red") && "shadow-red-500/10",
          )}>
            <Icon className={cn("w-6 h-6", iconColor)} />
          </div>
        )}
      </div>
      <div className="mt-8 flex items-end gap-2.5 h-14 opacity-90 group-hover:opacity-100 transition-all duration-700 px-1">
        {data.map((h, i) => (
          <div key={i} className="relative flex-1 group/bar" style={{ height: `${Math.min(h, 100)}%` }}>
            {/* Elegant Glassy 3D Bar */}
            <div className="absolute inset-x-0 bottom-0 h-full transition-all duration-700 cubic-bezier(0.23, 1, 0.32, 1) group-hover:scale-y-110 origin-bottom">
              {/* Main Front Glass Face */}
              <div className={cn(
                "absolute inset-0 rounded-sm z-10 border-t border-l border-white/20 backdrop-blur-[2px]",
                i % 3 === 0 && "bg-gradient-to-tr from-cyan-500/40 to-blue-400/20",
                i % 3 === 1 && "bg-gradient-to-tr from-blue-500/40 to-indigo-400/20",
                i % 3 === 2 && "bg-gradient-to-tr from-indigo-500/40 to-violet-400/20"
              )} />
              
              {/* Top Face (Polished Edge) */}
              <div className={cn(
                "absolute -top-[4px] left-[2px] right-[-2px] h-[4px] -skew-x-[45deg] z-20 rounded-t-sm border-t border-white/30",
                i % 3 === 0 && "bg-cyan-400/40",
                i % 3 === 1 && "bg-blue-400/40",
                i % 3 === 2 && "bg-indigo-400/40"
              )} />
              
              {/* Side Face (Refraction Edge) */}
              <div className={cn(
                "absolute top-[2px] -right-[4px] bottom-[-2px] w-[4px] -skew-y-[45deg] z-0 rounded-r-sm bg-black/20 border-r border-white/10",
                i % 3 === 0 && "bg-blue-900/30",
                i % 3 === 1 && "bg-indigo-900/30",
                i % 3 === 2 && "bg-violet-900/30"
              )} />
            </div>
            
            {/* Soft Ambient Glow */}
            <div className={cn(
                  "absolute -bottom-2 inset-x-0 h-2 blur-xl opacity-20 transition-opacity group-hover:opacity-40",
                  i % 3 === 0 && "bg-cyan-400",
                  i % 3 === 1 && "bg-blue-400",
                  i % 3 === 2 && "bg-indigo-400"
            )} />
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default StatsCard;
