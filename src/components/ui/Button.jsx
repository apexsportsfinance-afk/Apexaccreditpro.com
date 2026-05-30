import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

const variants = {
  primary: "bg-gradient-to-r from-primary-600 to-blue-600 text-white shadow-lg shadow-primary-500/25 hover:from-primary-500 hover:to-blue-500 hover:-translate-y-0.5 active:translate-y-0.5 active:scale-95",
  secondary: "bg-base-alt border border-border text-main hover:bg-base hover:border-primary-500/50 hover:-translate-y-0.5 active:translate-y-0.5 active:scale-95",
  danger: "bg-red-500 text-white shadow-lg shadow-red-500/20 hover:bg-red-600 hover:-translate-y-0.5 active:translate-y-0.5 active:scale-95",
  success: "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 hover:-translate-y-0.5 active:translate-y-0.5 active:scale-95",
  ghost: "text-muted hover:text-main hover:bg-base-alt/50 active:scale-95",
  outline: "border-2 border-primary-500 text-primary-600 dark:text-primary-400 hover:bg-primary-500/10 hover:-translate-y-0.5 active:translate-y-0.5 active:scale-95"
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
