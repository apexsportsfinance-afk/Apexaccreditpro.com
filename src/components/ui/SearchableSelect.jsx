import React, { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, X } from "lucide-react";
import { cn } from "../../lib/utils";

export function SearchableSelect({
  label,
  value,
  onChange,
  options = [],
  placeholder = "Select an option",
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

  const selectedOption = options.find((o) => o.value === value);

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

  const handleSelect = (option) => {
    onChange({ target: { value: option.value } });
    setIsOpen(false);
    setSearch("");
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange({ target: { value: "" } });
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
          "block text-lg font-medium",
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
            "w-full px-4 py-2.5 rounded-lg border text-lg transition-all text-left flex items-center justify-between gap-2",
            light
              ? "bg-white border-slate-300 text-slate-900 focus:ring-cyan-500/40 focus:border-cyan-500"
              : "bg-slate-800/50 border-slate-700 text-white focus:ring-primary-500/50 focus:border-primary-500",
            error && "border-red-500",
            isOpen && (light ? "ring-2 ring-cyan-500/40 border-cyan-500" : "ring-2 ring-primary-500/50 border-primary-500"),
            disabled && "opacity-60 cursor-not-allowed pointer-events-none"
          )}
        >
          <span className={selectedOption ? "" : (light ? "text-slate-400" : "text-slate-500")}>
            {selectedOption?.label || placeholder}
          </span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {value && (
              <span onClick={handleClear} className="p-0.5 rounded hover:bg-slate-200/20 cursor-pointer">
                <X className="w-3.5 h-3.5 text-slate-400" />
              </span>
            )}
            <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", isOpen && "rotate-180")} />
          </div>
        </button>

        {isOpen && (
          <div className={cn(
            "absolute z-[9999] mt-2 w-full rounded-xl border shadow-xl overflow-hidden",
            light
              ? "bg-white border-slate-200 shadow-slate-200/50"
              : "bg-slate-900 border-slate-700 shadow-black/50"
          )}>
            <div className={cn(
              "flex items-center gap-3 px-4 py-3 border-b",
              light ? "border-slate-100 bg-slate-50/50" : "border-slate-800 bg-slate-800/20"
            )}>
              <Search className={cn("w-4 h-4 flex-shrink-0", light ? "text-cyan-600" : "text-slate-400")} />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className={cn(
                  "flex-1 bg-transparent text-base focus:outline-none w-full min-w-0",
                  light ? "text-slate-700 placeholder-slate-400" : "text-white placeholder-slate-500"
                )}
              />
            </div>
            <div className="max-h-60 overflow-y-auto overscroll-contain">
              {filtered.length === 0 ? (
                <p className={cn(
                  "text-sm text-center py-6",
                  light ? "text-slate-400" : "text-slate-500"
                )}>
                  No options found
                </p>
              ) : (
                <div className="p-1.5 flex flex-col gap-0.5">
                  {filtered.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSelect(option)}
                      onTouchEnd={(e) => { e.preventDefault(); handleSelect(option); }}
                      className={cn(
                        "w-full px-4 py-3 text-left text-base transition-all rounded-lg select-none",
                        option.value === value
                          ? (light ? "bg-cyan-50 text-cyan-700 font-bold" : "bg-primary-500/20 text-primary-300 font-bold")
                          : (light ? "text-slate-600 hover:bg-slate-100/80 active:bg-slate-200" : "text-slate-200 hover:bg-slate-800/80 active:bg-slate-700")
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {error && (
        <p className="text-lg text-red-400 font-extralight">{error}</p>
      )}
    </div>
  );
}

export default SearchableSelect;
