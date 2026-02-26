import React from "react";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function StatsCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  iconColor = "text-primary-400",
  className
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-slate-900/50 border border-slate-800 rounded-xl p-6",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg font-medium text-slate-400">{title}</p>
          <p className="text-3xl font-bold text-white mt-2 font-mono">{value}</p>
          {change !== undefined && (
            <div className={cn(
              "flex items-center gap-1 mt-2 text-lg",
              changeType === "positive" ? "text-emerald-400" : 
              changeType === "negative" ? "text-red-400" : "text-slate-400"
            )}>
              {changeType === "positive" ? (
                <TrendingUp className="w-4 h-4" />
              ) : changeType === "negative" ? (
                <TrendingDown className="w-4 h-4" />
              ) : null}
              <span>{change}</span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn("p-3 rounded-xl bg-slate-800", iconColor)}>
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
    </motion.div>
  );
}
