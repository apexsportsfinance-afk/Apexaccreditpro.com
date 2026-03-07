import React from "react";
import { cn } from "../../lib/utils";

export function Select({
  label,
  error,
  options = [],
  placeholder,
  className,
  light = false,
  required = false,
  ...props
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className={cn(
          "block text-lg font-medium",
          light ? "text-slate-700" : "text-slate-300"
        )}>
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      <select
        className={cn(
          "w-full px-4 py-2.5 rounded-lg border text-lg transition-all duration-200 focus:outline-none focus:ring-2 appearance-none",
          light
            ? "bg-white border-slate-300 text-slate-900 focus:ring-cyan-500/40 focus:border-cyan-500"
            : "bg-slate-800/50 border-slate-700 text-white focus:ring-primary-500/50 focus:border-primary-500",
          error && "border-red-500",
          className
        )}
        {...props}
      >
        {placeholder && (
          <option value="">{placeholder}</option>
        )}
        {options.map((opt) => (
          <option
            key={opt.value}
            value={opt.value}
            className={light ? "bg-white text-slate-900" : "bg-slate-800 text-white"}
          >
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="text-lg text-red-400 font-extralight">{error}</p>
      )}
    </div>
  );
}

export default Select;
