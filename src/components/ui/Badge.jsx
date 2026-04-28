import React from "react";
import { cn } from "../../lib/utils";

const variants = {
  default: "bg-indigo-600 border border-indigo-400/30 text-white font-bold shadow-sm",
  primary: "bg-cyan-600 border border-cyan-400/30 text-white font-bold shadow-sm",
  success: "bg-emerald-600 border border-emerald-400/30 text-white font-bold shadow-sm",
  warning: "bg-amber-600 border border-amber-400/30 text-white font-bold shadow-sm",
  danger: "bg-rose-600 border border-rose-400/30 text-white font-bold shadow-sm",
  info: "bg-blue-600 border border-blue-400/30 text-white font-bold shadow-sm",
  solid: "bg-slate-800 border border-slate-700 text-slate-300 font-bold shadow-sm",
  muted: "bg-slate-500/10 border border-slate-500/20 text-slate-400 font-bold"
};

export function Badge({ children, variant = "default", className, ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
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
