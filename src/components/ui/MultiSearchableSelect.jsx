import React, { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, X, Check } from "lucide-react";
import { cn } from "../../lib/utils";

export function MultiSearchableSelect({
  label,
  value = [], // Array of selected values
  onChange,
  options = [],
  placeholder = "Select options",
  error,
  required = false,
  light = false,
  disabled = false,
  className
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);

  const toggleOption = (optionValue) => {
    const newValues = value.includes(optionValue)
      ? value.filter(v => v !== optionValue)
      : [...value, optionValue];
    onChange(newValues);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange([]);
    setSearch("");
  };

  const handleOpen = () => {
    if (disabled) return;
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  return (
    <div className={cn("space-y-1.5", className)} ref={containerRef}>
      {label && (
        <label className={cn(
          "block text-sm font-medium",
          light ? "text-slate-700" : "text-slate-300"
        )}>
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={handleOpen}
          disabled={disabled}
          className={cn(
            "w-full px-3 py-2 rounded-lg border text-sm transition-all text-left flex items-center justify-between gap-2 min-h-[42px]",
            light
              ? "bg-white border-slate-300 text-slate-900 focus:ring-cyan-500/40 focus:border-cyan-500"
              : "bg-slate-800 border-slate-600 text-white focus:ring-violet-500/50 focus:border-violet-500",
            error && "border-red-500",
            isOpen && (light ? "ring-2 ring-cyan-500/40 border-cyan-500" : "ring-2 ring-violet-500/50 border-violet-500"),
            disabled && "opacity-60 cursor-not-allowed pointer-events-none"
          )}
        >
          <div className="flex-1 overflow-hidden flex flex-wrap gap-1.5 items-center">
            {value.length === 0 ? (
              <span className={light ? "text-slate-400" : "text-slate-500"}>
                {placeholder}
              </span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {value.slice(0, 3).map(v => {
                  const opt = options.find(o => o.value === v);
                  return (
                    <span key={v} className="inline-flex items-center gap-1 bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded text-xs truncate max-w-[120px]">
                      {opt?.label || v}
                      <X className="w-3 h-3 cursor-pointer hover:text-white" onClick={(e) => { e.stopPropagation(); toggleOption(v); }} />
                    </span>
                  );
                })}
                {value.length > 3 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs text-slate-400 bg-slate-800 border border-slate-700">
                    +{value.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            {value.length > 0 && (
              <span onClick={handleClear} className="p-0.5 rounded hover:bg-slate-700/50 cursor-pointer">
                <X className="w-3.5 h-3.5 text-slate-400" />
              </span>
            )}
            <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", isOpen && "rotate-180")} />
          </div>
        </button>

        {isOpen && (
          <div className={cn(
            "absolute z-[99] mt-2 w-full rounded-xl border shadow-xl overflow-hidden",
            light
              ? "bg-white border-slate-200 shadow-slate-200/50"
              : "bg-slate-900 border-slate-700 shadow-black/50"
          )}>
            <div className={cn(
              "flex items-center gap-3 px-3 py-2.5 border-b",
              light ? "border-slate-100 bg-slate-50/50" : "border-slate-800 bg-slate-800/20"
            )}>
              <Search className={cn("w-4 h-4 flex-shrink-0", light ? "text-cyan-600" : "text-slate-400")} />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search organizations..."
                className={cn(
                  "flex-1 bg-transparent text-sm focus:outline-none w-full min-w-0",
                  light ? "text-slate-700 placeholder-slate-400" : "text-white placeholder-slate-500"
                )}
              />
            </div>
            <div className="max-h-60 overflow-y-auto overscroll-contain">
              <div className="p-1 border-b border-slate-800 flex justify-between items-center px-3 py-2 bg-slate-800/20">
                <span className="text-xs text-slate-400 font-medium">{value.length} selected</span>
                {value.length > 0 && (
                  <button type="button" onClick={() => onChange([])} className="text-xs text-violet-400 hover:text-violet-300 px-2 py-1 rounded hover:bg-violet-500/10 transition-colors">
                    Clear all
                  </button>
                )}
              </div>
              {filtered.length === 0 ? (
                <p className={cn(
                  "text-sm text-center py-6",
                  light ? "text-slate-400" : "text-slate-500"
                )}>
                  No options found
                </p>
              ) : (
                <div className="p-1.5 flex flex-col gap-0.5">
                  {filtered.map((option) => {
                    const isSelected = value.includes(option.value);
                    return (
                      <label
                        key={option.value}
                        className={cn(
                          "w-full px-3 py-2 text-left text-sm transition-all rounded-lg select-none flex items-center gap-3 cursor-pointer",
                          isSelected
                            ? (light ? "bg-cyan-50/50" : "bg-violet-500/10")
                            : (light ? "hover:bg-slate-100/80" : "hover:bg-slate-800/80")
                        )}
                      >
                        <div className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0",
                          isSelected
                            ? (light ? "bg-cyan-500 border-cyan-500 text-white" : "bg-violet-500 border-violet-500 text-white")
                            : (light ? "border-slate-300" : "border-slate-600 text-transparent")
                        )}>
                          <Check className={cn("w-3 h-3", isSelected ? "opacity-100" : "opacity-0")} />
                        </div>
                        <span className={cn(
                          "flex-1", 
                          isSelected ? (light ? "text-cyan-900 font-medium" : "text-violet-100 font-medium") : (light ? "text-slate-700" : "text-slate-300")
                        )}>
                          {option.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {error && (
        <p className="text-sm text-red-400 font-extralight">{error}</p>
      )}
    </div>
  );
}

export default MultiSearchableSelect;
