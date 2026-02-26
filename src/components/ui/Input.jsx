import React, { forwardRef } from "react";
import { cn } from "../../lib/utils";

const Input = forwardRef(({
  label,
  error,
  className,
  type = "text",
  light = false,
  ...props
}, ref) => {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className={cn(
          "block text-lg font-medium",
          light ? "text-slate-700" : "text-slate-300"
        )}>
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        ref={ref}
        type={type}
        className={cn(
          "w-full px-4 py-2.5 rounded-lg transition-colors duration-200",
          "focus:outline-none focus:ring-2",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "text-lg",
          light
            ? "bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:ring-primary-400/50 focus:border-primary-500"
            : "bg-slate-800/50 border border-slate-700 text-white placeholder-slate-500 focus:ring-primary-500/50 focus:border-primary-500",
          error && (light ? "border-red-400 focus:ring-red-400/50 focus:border-red-400" : "border-red-500 focus:ring-red-500/50 focus:border-red-500"),
          className
        )}
        {...props}
      />
      {error && (
        <p className={cn("text-lg", light ? "text-red-500" : "text-red-400")}>{error}</p>
      )}
    </div>
  );
});

Input.displayName = "Input";

export { Input };
export default Input;
