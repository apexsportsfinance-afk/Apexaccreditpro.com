import React from "react";
import { cn } from "../../lib/utils";

const variants = {
  default: "bg-white/5 border border-white/10 text-whiteElite shadow-sm",
  primary: "bg-primary/20 border border-primary/30 text-primary shadow-cyanGlow",
  success: "bg-success/20 border border-success/30 text-success shadow-successGlow",
  warning: "bg-warning/20 border border-warning/30 text-warning",
  danger: "bg-critical/20 border border-critical/30 text-critical",
  info: "bg-primary/10 border border-primary/20 text-primary-400",
  solid: "bg-base border border-white/10 text-whiteElite"
};

export function Badge({ children, variant = "default", className, ...props }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-meta",
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
