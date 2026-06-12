import React, { useState, useRef, useEffect } from "react";
import { Search, X, Check } from "lucide-react";
import { cn } from "../../lib/utils";

export function MultiSearchableSelect({
  label,
  value = [],
  onChange,
  options = [],
  placeholder = "Search and select options...",
  error,
  required = false,
  disabled = false,
  className,
  creatable = false,
  light = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const filtered = options.filter(
    (o) =>
      o.label.toLowerCase().includes(search.toLowerCase()) ||
      o.value.toLowerCase().includes(search.toLowerCase())
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

  const toggleOption = (e, optionValue) => {
    e.stopPropagation();
    const newValue = value.includes(optionValue)
      ? value.filter((v) => v !== optionValue)
      : [...value, optionValue];
    onChange(newValue);
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

  const removeOption = (e, optionValue) => {
    e.stopPropagation();
    onChange(value.filter((v) => v !== optionValue));
  };

  const handleCreate = (e) => {
    if (e.key === "Enter" && creatable && search.trim()) {
      e.preventDefault();
      const newVal = search.trim();
      if (!value.includes(newVal)) {
        onChange([...value, newVal]);
      }
      setSearch("");
    }
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
          className={cn(
            "w-full px-3 py-2.5 rounded-lg border text-lg transition-all text-left flex items-center justify-between gap-2 min-h-[48px] bg-base border-border focus:ring-primary-500/40 focus:border-primary-500",
            light ? "text-white" : "text-main",
            error && "border-red-500",
            isOpen && "ring-2 ring-primary-500/50 border-primary-500",
            disabled && "opacity-60 cursor-not-allowed pointer-events-none"
          )}
        >
          <div className="flex flex-wrap gap-1.5 flex-1 overflow-hidden">
            {value.length === 0 ? (
              <span className={cn("px-1", light ? "text-slate-300" : "text-muted")}>{placeholder}</span>
            ) : (
              <>
                {value.slice(0, 3).map((val) => {
                  const opt = options.find((o) => o.value === val);
                  return (
                    <span
                      key={val}
                      className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-bold border transition-colors select-none",
                        light ? "bg-white/10 border-white/20 text-white" : "bg-base-alt border-border text-main"
                      )}
                    >
                      {opt?.label || val}
                      <X
                        className="w-3 h-3 hover:text-red-500 cursor-pointer transition-colors"
                        onClick={(e) => removeOption(e, val)}
                      />
                    </span>
                  );
                })}
                {value.length > 3 && (
                  <span className={cn(
                    "inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border",
                    light ? "bg-white/10 border-white/20 text-slate-200" : "text-muted bg-base-alt border-border"
                  )}>
                    +{value.length - 3} more
                  </span>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            {value.length > 0 && (
              <span onClick={handleClear} className="p-1 rounded-lg hover:bg-base-alt transition-colors cursor-pointer group">
                <X className={cn("w-4 h-4 group-hover:text-red-500", light ? "text-slate-300" : "text-muted")} />
              </span>
            )}
          </div>
        </button>

        {isOpen && (
          <div className="absolute z-[99] mt-2 w-full rounded-xl border border-border bg-base shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-base-alt/30">
              <Search className={cn("w-4 h-4 flex-shrink-0", light ? "text-primary-400" : "text-primary-500")} />
              <input
                ref={inputRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleCreate}
                placeholder={creatable ? "Search or type and press Enter to create..." : "Search..."}
                className={cn(
                  "flex-1 bg-transparent text-base focus:outline-none w-full min-w-0",
                  light ? "text-white placeholder-slate-400" : "text-main placeholder-muted"
                )}
              />
            </div>
            <div className="max-h-60 overflow-y-auto overscroll-contain divide-y divide-border">
              <div className="p-1 flex justify-between items-center px-4 py-2 border-b border-border bg-base-alt/10">
                <span className={cn("text-[10px] font-black uppercase tracking-widest", light ? "text-slate-400" : "text-muted")}>{value.length} selected</span>
                {value.length > 0 && (
                  <button type="button" onClick={() => onChange([])} className="text-[10px] font-black uppercase tracking-widest text-primary-600 hover:text-primary-500 transition-colors">
                    Clear All
                  </button>
                )}
              </div>
              {filtered.length === 0 && !(creatable && search.trim()) ? (
                <p className={cn("text-sm text-center py-6 font-light italic", light ? "text-slate-400" : "text-muted")}>
                  No options found
                </p>
              ) : (
                <div className="p-1 flex flex-col gap-0.5">
                  {filtered.map((option) => {
                    const isSelected = value.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={(e) => toggleOption(e, option.value)}
                        className={cn(
                          "w-full px-4 py-3 text-left text-base transition-all rounded-lg select-none flex items-center gap-3 cursor-pointer group",
                          isSelected
                            ? (light ? "bg-primary-500/20" : "bg-primary-500/10")
                            : (light ? "hover:bg-white/10" : "hover:bg-base-alt active:bg-primary-500/5")
                        )}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors",
                          isSelected 
                            ? "bg-primary-500 border-primary-500 text-white" 
                            : (light ? "border-slate-500 group-hover:border-slate-300" : "border-border group-hover:border-primary-500/50")
                        )}>
                          {isSelected && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                        </div>
                        <span className={cn(
                          "flex-1 transition-colors", 
                          isSelected 
                            ? (light ? "text-white font-bold" : "text-primary-600 dark:text-primary-400 font-bold") 
                            : (light ? "text-slate-200 group-hover:text-white" : "text-main")
                        )}>
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                  
                  {creatable && search.trim() && !options.some(o => o.value.toLowerCase() === search.trim().toLowerCase()) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange([...value, search.trim()]);
                        setSearch("");
                      }}
                      className={cn(
                        "w-full px-4 py-3 text-left text-base transition-all rounded-lg select-none flex items-center gap-2 text-primary-600",
                        light ? "hover:bg-white/10" : "hover:bg-base-alt"
                      )}
                    >
                      <span className={cn("text-xl font-light", light ? "text-slate-400" : "text-muted")}>+</span>
                      Create "{search.trim()}"
                    </button>
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
