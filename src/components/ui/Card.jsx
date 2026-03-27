import React from "react";
import { cn } from "../../lib/utils";

export function Card({ children, className, ...props }) {
  return (
    <div
      className={cn(
        "glass-card rounded-2xl transition-all duration-300",
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
