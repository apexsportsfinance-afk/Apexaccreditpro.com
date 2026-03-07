import React from "react";
import { cn } from "../../lib/utils";

export function Card({ children, className, ...props }) {
  return (
    <div
      className={cn(
        "bg-gradient-to-br from-swim-deep/60 via-primary-950/50 to-ocean-950/40 border border-primary-500/20 rounded-xl shadow-xl shadow-primary-900/20",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className, ...props }) {
  return (
    <div
      className={cn(
        "px-6 py-4 border-b border-primary-500/20",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardContent({ children, className, ...props }) {
  return (
    <div className={cn("px-6 py-4", className)} {...props}>
      {children}
    </div>
  );
}

export default Card;
