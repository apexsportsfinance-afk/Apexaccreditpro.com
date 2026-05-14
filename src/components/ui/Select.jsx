import React from "react";
import { cn } from "../../lib/utils";

export function Select({
  label,
  error,
  options = [],
  placeholder,
  className,
  required = false,
  ...props
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-lg font-medium text-main">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          className={cn(
            "w-full px-4 py-2.5 rounded-lg border text-lg transition-all duration-200 focus:outline-none focus:ring-2 appearance-none bg-base border-border text-main focus:ring-primary-500/40 focus:border-primary-500",
            error && "border-red-500",
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" className="bg-base text-muted">{placeholder}</option>
          )}
          {options.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              className="bg-base text-main"
            >
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {error && (
        <p className="text-lg text-red-500 font-extralight mt-1">{error}</p>
      )}
    </div>
  );
}

export default Select;
