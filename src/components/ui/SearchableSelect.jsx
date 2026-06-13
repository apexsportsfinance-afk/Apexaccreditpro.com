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
  disabled = false,
  className,
  light = false
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
    <div className={cn("space-y-1.5 w-full", className)} ref={containerRef}>
      {label && (
        <label className={cn("block text-lg font-medium", light ? "text-slate-700" : "text-main")}>
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={handleOpen}
          disabled={disabled}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-controls="searchable-select-listbox"
          aria-label={!label ? placeholder : undefined}
          className={cn(
            "w-full px-4 py-2.5 rounded-lg border text-lg transition-all text-left flex items-center justify-between gap-2 bg-base border-border focus:ring-primary-500/40 focus:border-primary-500",
            light ? "text-white" : "text-main",
            error && "border-red-500",
            isOpen && "ring-2 ring-primary-500/50 border-primary-500",
            disabled && "opacity-60 cursor-not-allowed pointer-events-none"
          )}
        >
          <span className={selectedOption ? "" : (light ? "text-slate-300" : "text-muted")}>
            {selectedOption?.label || placeholder}
          </span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {value && (
              <span onClick={handleClear} className="p-0.5 rounded hover:bg-base-alt cursor-pointer z-10 relative">
                <X className={cn("w-3.5 h-3.5 transition-colors", light ? "text-slate-300 hover:text-white" : "text-muted")} />
              </span>
            )}
            <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180", light ? "text-slate-300" : "text-muted")} />
          </div>
        </button>

        {isOpen && (
          <div className="absolute z-[9999] mt-2 w-full rounded-xl border border-border bg-base shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-base-alt/50">
              <Search className={cn("w-4 h-4 flex-shrink-0", light ? "text-primary-400" : "text-primary-500")} />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                aria-label="Search options"
                className={cn(
                  "flex-1 bg-transparent text-base focus:outline-none w-full min-w-0",
                  light ? "text-white placeholder-slate-400" : "text-main placeholder-muted"
                )}
              />
            </div>
            <div id="searchable-select-listbox" role="listbox" className="max-h-60 overflow-y-auto overscroll-contain divide-y divide-border">
              {filtered.length === 0 ? (
                <p className={cn("text-sm text-center py-6", light ? "text-slate-400" : "text-muted")}>
                  No options found
                </p>
              ) : (
                <div className="p-1 flex flex-col gap-0.5">
                  {filtered.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={option.value === value}
                      onClick={() => handleSelect(option)}
                      className={cn(
                        "w-full px-4 py-3 text-left text-base transition-all rounded-lg select-none",
                        option.value === value
                          ? (light ? "bg-primary-500/20 text-white font-bold" : "bg-primary-500/10 text-primary-600 dark:text-primary-400 font-bold")
                          : (light ? "text-slate-200 hover:bg-white/10 hover:text-white" : "text-main hover:bg-base-alt active:bg-primary-500/10")
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
        <p className="text-lg text-red-500 font-extralight mt-1">{error}</p>
      )}
    </div>
  );
}

export default SearchableSelect;

