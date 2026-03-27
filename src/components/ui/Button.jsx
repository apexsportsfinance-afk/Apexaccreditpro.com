import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

const variants = {
  primary: "bg-primary-500 hover:bg-primary-600 text-white shadow shadow-primary-500/20",
  secondary: "bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700",
  danger: "bg-red-600 hover:bg-red-700 text-white shadow shadow-red-900/20",
  success: "bg-emerald-600 hover:bg-emerald-700 text-white shadow shadow-emerald-900/20",
  ghost: "text-slate-400 hover:text-white hover:bg-slate-800",
  outline: "border border-primary-500 text-primary-400 hover:bg-primary-500/10"
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
        "inline-flex items-center justify-center font-medium rounded transition-all duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
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
