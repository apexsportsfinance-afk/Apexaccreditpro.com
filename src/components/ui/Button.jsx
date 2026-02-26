import React from "react";
import { motion } from "motion/react";
import { cn } from "../../lib/utils";

const variants = {
  primary: "bg-gradient-to-r from-primary-500 via-ocean-500 to-aqua-600 hover:from-primary-400 hover:via-ocean-400 hover:to-aqua-500 text-white shadow-lg shadow-primary-500/40",
  secondary: "bg-gradient-to-r from-swim-deep to-primary-900 hover:from-primary-900 hover:to-ocean-900 text-white border border-primary-500/30 hover:border-primary-400/50",
  success: "bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-400 text-white shadow-lg shadow-emerald-500/40",
  danger: "bg-gradient-to-r from-red-500 via-rose-500 to-pink-500 hover:from-red-400 hover:via-rose-400 hover:to-pink-400 text-white shadow-lg shadow-red-500/40",
  warning: "bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 hover:from-amber-400 hover:via-orange-400 hover:to-yellow-400 text-white shadow-lg shadow-amber-500/40",
  ghost: "bg-transparent hover:bg-primary-500/20 text-primary-300 hover:text-white",
  outline: "bg-transparent border border-primary-400/50 hover:border-primary-300 text-primary-300 hover:text-primary-200 hover:bg-primary-500/10"
};

const sizes = {
  sm: "px-3 py-1.5 text-lg",
  md: "px-4 py-2 text-lg",
  lg: "px-6 py-3 text-lg"
};

function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  disabled,
  loading,
  icon: Icon,
  ...props
}) {
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : Icon ? (
        <Icon className="w-5 h-5" />
      ) : null}
      {children}
    </motion.button>
  );
}

export { Button };
export default Button;