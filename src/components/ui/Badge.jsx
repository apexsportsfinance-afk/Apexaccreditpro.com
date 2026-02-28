import React from "react";
import { cn } from "../../lib/utils";

function Badge({ children, className, variant = "default" }) {
  const variants = {
    default: "bg-slate-700 text-slate-200 border border-slate-600",
    primary: "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40",
    success: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
    warning: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
    danger: "bg-red-500/20 text-red-300 border border-red-500/40",
    info: "bg-blue-500/20 text-blue-300 border border-blue-500/40"
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold tracking-wide",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export { Badge };
export default Badge;
