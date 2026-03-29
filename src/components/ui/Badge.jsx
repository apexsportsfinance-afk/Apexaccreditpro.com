import React from "react";
import { cn } from "../../lib/utils";

const variants = {
  default: "bg-gradient-to-b from-white/10 to-white/5 border border-white/10 text-whiteElite shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_1px_2px_rgba(0,0,0,0.5)]",
  primary: "bg-gradient-to-b from-primary/30 to-primary/10 border border-primary/40 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_1px_3px_rgba(0,0,0,0.4)] shadow-cyanGlow",
  success: "bg-gradient-to-b from-success/30 to-success/10 border border-success/40 text-success shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_1px_3px_rgba(0,0,0,0.4)] shadow-successGlow",
  warning: "bg-gradient-to-b from-warning/30 to-warning/10 border border-warning/40 text-warning shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_1px_3px_rgba(0,0,0,0.4)]",
  danger: "bg-gradient-to-b from-critical/30 to-critical/10 border border-critical/40 text-critical shadow-[inset_0_1px_0_rgba(255,255,255,0.15),0_1px_3px_rgba(0,0,0,0.4)]",
  info: "bg-gradient-to-b from-primary/20 to-primary/5 border border-primary/20 text-primary-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_1px_2px_rgba(0,0,0,0.3)]",
  solid: "bg-base border border-white/10 text-whiteElite shadow-lg"
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
