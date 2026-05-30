import React, { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, X, Check, Plus } from "lucide-react";
import { cn } from "../../lib/utils";

export function MultiSearchableSelect({
  label,
  value = [], // Array of selected values
  onChange,
  options = [],
  placeholder = "Select options",
  error,
  required = false,
  disabled = false,
  creatable = false,
  creatableText = "Add",
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
    <div className={cn("space-y-1.5 w-full", className)} ref={containerRef}>
      {label && (
        <label className="block text-lg font-medium text-main">
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
            "w-full px-3 py-2.5 rounded-lg border text-lg transition-all text-left flex items-center justify-between gap-2 min-h-[48px] bg-base border-border text-main focus:ring-primary-500/40 focus:border-primary-500",
            error && "border-red-500",
            isOpen && "ring-2 ring-primary-500/50 border-primary-500",
            disabled && "opacity-60 cursor-not-allowed pointer-events-none"
          )}
        >
          <div className="flex-1 overflow-hidden flex flex-wrap gap-1.5 items-center">
            {value.length === 0 ? (
              <span className="text-muted">
                {placeholder}
              </span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {value.slice(0, 3).map(v => {
                  const opt = options.find(o => o.value === v);
                  return (
                    <span key={v} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-primary-500/10 text-primary-600 dark:text-primary-400 border-primary-500/20 transition-all hover:bg-primary-500/20">
                      {opt?.label || v}
                      <X className="w-3 h-3 cursor-pointer hover:scale-120 transition-transform" onClick={(e) => { e.stopPropagation(); toggleOption(v); }} />
                    </span>
                  );
                })}
                {value.length > 3 && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border text-muted bg-base-alt border-border">
                    +{value.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            {value.length > 0 && (
              <span onClick={handleClear} className="p-1 rounded-lg hover:bg-base-alt transition-colors cursor-pointer group">
                <X className="w-4 h-4 text-muted group-hover:text-red-500" />
              </span>
            )}
            <ChevronDown className={cn("w-4 h-4 text-muted transition-transform duration-300", isOpen && "rotate-180")} />
          </div>
        </button>

        {isOpen && (
          <div className="absolute z-[99] mt-2 w-full rounded-xl border border-border bg-base shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-base-alt/30">
              <Search className="w-4 h-4 flex-shrink-0 text-primary-500" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="flex-1 bg-transparent text-base focus:outline-none w-full min-w-0 text-main placeholder-muted"
              />
            </div>
            <div className="max-h-60 overflow-y-auto overscroll-contain divide-y divide-border">
              <div className="p-1 flex justify-between items-center px-4 py-2 border-b border-border bg-base-alt/10">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted">{value.length} selected</span>
                {value.length > 0 && (
                  <button type="button" onClick={() => onChange([])} className="text-[10px] font-black uppercase tracking-widest text-primary-600 hover:text-primary-500 transition-colors">
                    Clear all
                  </button>
                )}
              </div>
              {filtered.length === 0 && !(creatable && search.trim()) ? (
                <p className="text-sm text-center py-6 text-muted font-light italic">
                  No options found
                </p>
              ) : (
                <div className="p-1 flex flex-col gap-0.5">
                  {filtered.map((option) => {
                    const isSelected = value.includes(option.value);
                    return (
                      <label
                        key={option.value}
                        onClick={(e) => {
                          e.preventDefault();
                          toggleOption(option.value);
                        }}
                        className={cn(
                          "w-full px-4 py-3 text-left text-base transition-all rounded-lg select-none flex items-center gap-3 cursor-pointer group",
                          isSelected
                            ? "bg-primary-500/10"
                            : "hover:bg-base-alt active:bg-primary-500/5"
                        )}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded border flex items-center justify-center transition-all shrink-0",
                          isSelected
                            ? "bg-primary-500 border-primary-500 shadow-sm shadow-primary-500/20"
                            : "border-border bg-white/5 group-hover:border-primary-500/50"
                        )}>
                          {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                        </div>
                        <span className={cn(
                          "flex-1 transition-colors", 
                          isSelected ? "text-primary-600 dark:text-primary-400 font-bold" : "text-main"
                        )}>
                          {option.label}
                        </span>
                      </label>
                    );
                  })}
                  {creatable && search.trim() && !options.some(o => o.label.toLowerCase() === search.trim().toLowerCase()) && (
                    <label
                      onClick={(e) => {
                        e.preventDefault();
                        toggleOption(search.trim());
                        setSearch("");
                        setIsOpen(false);
                      }}
                      className="w-full px-4 py-3 text-left text-base transition-all rounded-lg select-none flex items-center gap-3 cursor-pointer hover:bg-primary-500/10 text-primary-500"
                    >
                      <div className="w-5 h-5 rounded border border-primary-500/50 bg-primary-500/10 flex items-center justify-center shrink-0">
                        <Plus className="w-3.5 h-3.5 text-primary-500" />
                      </div>
                      <span className="flex-1 font-bold">
                        {creatableText} "{search.trim()}"
                      </span>
                    </label>
                  )}
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

export default MultiSearchableSelect;
