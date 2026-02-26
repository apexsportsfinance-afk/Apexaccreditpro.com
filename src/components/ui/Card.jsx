import React from "react";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";

function Card({
  children,
  className,
  hover = false,
  ...props
}) {
  const Component = hover ? motion.div : "div";
  return (
    <Component
      className={cn(
        "bg-slate-900/80 border border-slate-700/50 rounded-xl backdrop-blur-sm shadow-xl shadow-black/30",
        className
      )}
      {...(hover && {
        whileHover: { scale: 1.01, borderColor: "rgba(6, 182, 212, 0.4)" },
        transition: { duration: 0.15 }
      })}
      {...props}
    >
      {children}
    </Component>
  );
}

function CardHeader({ children, className }) {
  return (
    <div className={cn(
      "px-5 py-4 border-b border-slate-700/50 bg-slate-800/40",
      className
    )}>
      {children}
    </div>
  );
}

function CardContent({ children, className }) {
  return (
    <div className={cn("p-5", className)}>
      {children}
    </div>
  );
}

function CardFooter({ children, className }) {
  return (
    <div className={cn(
      "px-5 py-4 border-t border-slate-700/50 bg-slate-800/20",
      className
    )}>
      {children}
    </div>
  );
}

export { Card, CardHeader, CardContent, CardFooter };
export default Card;