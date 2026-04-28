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
            "w-full px-4 py-2.5 rounded-lg border text-lg transition-all text-left flex items-center justify-between gap-2 bg-base border-border text-main focus:ring-primary-500/40 focus:border-primary-500",
            error && "border-red-500",
            isOpen && "ring-2 ring-primary-500/50 border-primary-500",
            disabled && "opacity-60 cursor-not-allowed pointer-events-none"
          )}
        >
          <span className={selectedOption ? "" : "text-muted"}>
            {selectedOption?.label || placeholder}
          </span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {value && (
              <span onClick={handleClear} className="p-0.5 rounded hover:bg-base-alt cursor-pointer">
                <X className="w-3.5 h-3.5 text-muted" />
              </span>
            )}
            <ChevronDown className={cn("w-4 h-4 text-muted transition-transform", isOpen && "rotate-180")} />
          </div>
        </button>

        {isOpen && (
          <div className="absolute z-[9999] mt-2 w-full rounded-xl border border-border bg-base shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-base-alt/50">
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
              {filtered.length === 0 ? (
                <p className="text-sm text-center py-6 text-muted">
                  No options found
                </p>
              ) : (
                <div className="p-1 flex flex-col gap-0.5">
                  {filtered.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSelect(option)}
                      className={cn(
                        "w-full px-4 py-3 text-left text-base transition-all rounded-lg select-none",
                        option.value === value
                          ? "bg-primary-500/10 text-primary-600 dark:text-primary-400 font-bold"
                          : "text-main hover:bg-base-alt active:bg-primary-500/10"
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
