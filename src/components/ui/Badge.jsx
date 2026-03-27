import React from "react";
import { cn } from "../../lib/utils";

const variants = {
  default: "bg-gradient-to-b from-slate-700 to-slate-800 border border-slate-700 text-white shadow-[0_3px_8px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.15)] ring-1 ring-black/50 backdrop-blur-md",
  primary: "bg-gradient-to-b from-cyan-600 to-cyan-800 border border-cyan-500/50 text-white shadow-[0_3px_12px_rgba(6,182,212,0.4),inset_0_1px_1px_rgba(255,255,255,0.2)] ring-1 ring-black/50 backdrop-blur-md",
  success: "bg-gradient-to-b from-emerald-600 to-emerald-800 border border-emerald-500/50 text-white shadow-[0_3px_12px_rgba(16,185,129,0.4),inset_0_1px_1px_rgba(255,255,255,0.2)] ring-1 ring-black/50 backdrop-blur-md",
  warning: "bg-gradient-to-b from-amber-600 to-amber-800 border border-amber-500/50 text-white shadow-[0_3px_12px_rgba(245,158,11,0.4),inset_0_1px_1px_rgba(255,255,255,0.2)] ring-1 ring-black/50 backdrop-blur-md",
  danger: "bg-gradient-to-b from-red-600 to-red-800 border border-red-500/50 text-white shadow-[0_3px_12px_rgba(239,68,68,0.4),inset_0_1px_1px_rgba(255,255,255,0.2)] ring-1 ring-black/50 backdrop-blur-md",
  info: "bg-gradient-to-b from-blue-600 to-blue-800 border border-blue-500/50 text-white shadow-[0_3px_12px_rgba(59,130,246,0.4),inset_0_1px_1px_rgba(255,255,255,0.2)] ring-1 ring-black/50 backdrop-blur-md",
  solid: "bg-slate-900 border border-slate-700 text-white shadow-[0_3px_12px_rgba(0,0,0,0.5)]"
};

export function Badge({ children, variant = "default", className, ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-widest",
        variants[variant] || variants.default,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export default Badge;
