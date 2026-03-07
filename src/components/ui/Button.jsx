import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

const variants = {
  primary: "bg-gradient-to-r from-primary-600 via-ocean-600 to-aqua-700 hover:from-primary-500 hover:via-ocean-500 hover:to-aqua-600 text-white shadow-lg shadow-primary-900/30",
  secondary: "bg-slate-800/80 border border-slate-700/60 text-slate-200 hover:bg-slate-700/80 hover:border-slate-600",
  danger: "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-900/30",
  success: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-900/30",
  ghost: "text-slate-400 hover:text-white hover:bg-slate-800/60",
  outline: "border border-primary-500/50 text-primary-300 hover:bg-primary-500/10 hover:border-primary-400"
};

const sizes = {
  sm: "px-3 py-1.5 text-lg gap-1.5",
  md: "px-4 py-2.5 text-lg gap-2",
  lg: "px-6 py-3 text-xl gap-2.5"
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  icon: Icon,
  loading = false,
  disabled = false,
  className,
  type = "button",
  onClick,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500/40 disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant] || variants.primary,
        sizes[size] || sizes.md,
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : Icon ? (
        <Icon className="w-4 h-4 flex-shrink-0" />
      ) : null}
      {children}
    </button>
  );
}

export default Button;
