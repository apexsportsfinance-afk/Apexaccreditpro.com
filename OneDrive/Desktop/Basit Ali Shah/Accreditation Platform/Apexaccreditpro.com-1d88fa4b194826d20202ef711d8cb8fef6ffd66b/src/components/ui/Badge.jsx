import React from "react";
import { cn } from "../../lib/utils";

const variants = {
  default: "bg-slate-500/20 text-slate-300 border border-slate-500/40",
  primary: "bg-primary-500/20 text-primary-300 border border-primary-500/40",
  success: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40",
  warning: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
  danger: "bg-red-500/20 text-red-300 border border-red-500/40",
  info: "bg-blue-500/20 text-blue-300 border border-blue-500/40"
};

export function Badge({ children, variant = "default", className, ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-lg font-medium",
        variants[variant] || variant,
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export default Badge;
