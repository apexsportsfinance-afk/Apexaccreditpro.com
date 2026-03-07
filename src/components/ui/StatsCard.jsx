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
  className
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-gradient-to-br from-swim-deep/60 via-primary-950/50 to-ocean-950/40 border border-primary-500/20 rounded-xl p-5 shadow-lg shadow-primary-900/20",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-lg text-slate-400 font-extralight mb-1">{title}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
          {change && (
            <p className={cn(
              "text-lg mt-1 font-extralight",
              changeType === "positive" && "text-emerald-400",
              changeType === "negative" && "text-red-400",
              changeType === "neutral" && "text-slate-500"
            )}>
              {change}
            </p>
          )}
        </div>
        {Icon && (
          <div className="p-3 rounded-xl bg-primary-500/10 border border-primary-500/20">
            <Icon className={cn("w-6 h-6", iconColor)} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default StatsCard;
