import React, { forwardRef } from "react";
import { cn } from "../../lib/utils";
import { ChevronDown } from "lucide-react";

const Select = forwardRef(({
  label,
  error,
  options = [],
  placeholder = "Select an option",
  className,
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
          {props.required && <span className={light ? "text-red-500 ml-1" : "text-red-400 ml-1"}>*</span>}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          className={cn(
            "w-full px-4 py-2.5 rounded-lg appearance-none cursor-pointer transition-colors duration-200",
            "focus:outline-none focus:ring-2",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "text-lg",
            light
              ? "bg-white border border-slate-300 text-slate-900 focus:ring-primary-400/50 focus:border-primary-500"
              : "bg-slate-800/50 border border-slate-700 text-white focus:ring-primary-500/50 focus:border-primary-500",
            error && (light ? "border-red-400 focus:ring-red-400/50 focus:border-red-400" : "border-red-500 focus:ring-red-500/50 focus:border-red-500"),
            className
          )}
          {...props}
        >
          <option value="" className={light ? "bg-white" : "bg-slate-800"}>{placeholder}</option>
          {options.map((option) => (
            <option
              key={option.value}
              value={option.value}
              className={light ? "bg-white" : "bg-slate-800"}
            >
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className={cn(
          "absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none",
          light ? "text-slate-500" : "text-slate-400"
        )} />
      </div>
      {error && (
        <p className={cn("text-lg", light ? "text-red-500" : "text-red-400")}>{error}</p>
      )}
    </div>
  );
});

Select.displayName = "Select";

export default Select;
