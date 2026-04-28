import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "../../lib/utils";

export function Input({
  label,
  error,
  className,
  required = false,
  icon: Icon,
  ...props
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = props.type === "password";
  const inputType = isPassword ? (showPassword ? "text" : "password") : props.type;

  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label className="block text-lg font-medium text-main">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 z-10 pointer-events-none text-primary-500" />
        )}
        <input
          {...props}
          type={inputType}
          style={Object.assign({ textAlign: 'left' }, props.style || {})}
          className={cn(
            "w-full py-2.5 rounded-lg border text-lg transition-all duration-200 focus:outline-none focus:ring-2 bg-base border-border text-main placeholder-muted focus:ring-primary-500/40 focus:border-primary-500",
            Icon ? "pl-11 pr-4" : "px-4",
            isPassword ? "pr-12" : "",
            error && "border-red-500 focus:ring-red-500/40",
            className
          )}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary-500 transition-colors"
            tabIndex="-1"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        )}
      </div>
      {error && (
        <p className="text-lg text-red-500 font-extralight mt-1">{error}</p>
      )}
    </div>
  );
}

export default Input;
