import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, Check, X } from "lucide-react";
import { cn } from "../../lib/utils";

export function SearchableSelect({
  label,
  options = [],
  value,
  onChange,
  placeholder = "Select option",
  error,
  required,
  disabled,
  light = false,
  className
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSelect = (option) => {
    onChange({ target: { name: "", value: option.value } });
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange({ target: { name: "", value: "" } });
    setSearchTerm("");
  };

  return (
    <div className={cn("space-y-1.5", isOpen && "relative z-[9999]")} ref={containerRef}>
      {label && (
        <label className={cn(
          "block text-lg font-medium",
          light ? "text-slate-700" : "text-slate-300"
        )}>
          {label}
          {required && <span className={light ? "text-red-500 ml-1" : "text-red-400 ml-1"}>*</span>}
        </label>
      )}
      <div className="relative">
        {/* Main select trigger - styled exactly like Select component */}
        <div
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={cn(
            "w-full px-4 py-2.5 rounded-lg cursor-pointer transition-colors duration-200",
            "flex items-center justify-between",
            "text-lg",
            light
              ? "bg-white border border-slate-300 text-slate-900"
              : "bg-slate-800/50 border border-slate-700 text-white",
            isOpen && (light 
              ? "ring-2 ring-primary-400/50 border-primary-500" 
              : "ring-2 ring-primary-500/50 border-primary-500"),
            error && (light 
              ? "border-red-400 ring-red-400/50" 
              : "border-red-500 ring-red-500/50"),
            disabled && "opacity-50 cursor-not-allowed",
            className
          )}
        >
          <span className={cn(
            "truncate",
            selectedOption ? "" : (light ? "text-slate-400" : "text-slate-500")
          )}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <div className="flex items-center gap-1">
            {value && !disabled && (
              <button
                type="button"
                onClick={handleClear}
                className={cn(
                  "p-0.5 rounded-full transition-colors",
                  light ? "hover:bg-slate-200" : "hover:bg-slate-600"
                )}
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <ChevronDown className={cn(
              "w-5 h-5 transition-transform pointer-events-none",
              isOpen && "rotate-180",
              light ? "text-slate-500" : "text-slate-400"
            )} />
          </div>
        </div>

        {/* Dropdown panel */}
        {isOpen && (
          <div
            className={cn(
              "absolute z-[9999] w-full mt-1 rounded-lg border overflow-hidden",
              light
                ? "bg-white border-slate-300 shadow-lg"
                : "bg-slate-800 border-slate-700 shadow-xl"
            )}
            style={{ maxHeight: "320px" }}
          >
            {/* Search Input */}
            <div className={cn(
              "p-2 border-b",
              light ? "border-slate-200 bg-slate-50" : "border-slate-700 bg-slate-800/80"
            )}>
              <div className="relative">
                <Search className={cn(
                  "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4",
                  light ? "text-slate-400" : "text-slate-500"
                )} />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Type to search..."
                  className={cn(
                    "w-full pl-9 pr-3 py-2 rounded-md text-lg",
                    "focus:outline-none transition-all",
                    light
                      ? "bg-white border border-slate-300 text-slate-900 placeholder-slate-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-400/30"
                      : "bg-slate-900/50 border border-slate-600 text-white placeholder-slate-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30"
                  )}
                />
              </div>
            </div>

            {/* Options List */}
            <div className="overflow-y-auto" style={{ maxHeight: "250px" }}>
              {filteredOptions.length === 0 ? (
                <div className={cn(
                  "px-4 py-4 text-center text-lg",
                  light ? "text-slate-500" : "text-slate-400"
                )}>
                  No results found
                </div>
              ) : (
                filteredOptions.map((option) => {
                  const isSelected = option.value === value;
                  return (
                    <div
                      key={option.value}
                      onClick={() => handleSelect(option)}
                      className={cn(
                        "px-4 py-2.5 cursor-pointer flex items-center justify-between text-lg transition-colors",
                        isSelected
                          ? (light ? "bg-primary-50 text-primary-700" : "bg-primary-500/20 text-primary-300")
                          : (light ? "hover:bg-slate-100 text-slate-700" : "hover:bg-slate-700 text-slate-200")
                      )}
                    >
                      <span className="truncate">{option.label}</span>
                      {isSelected && (
                        <Check className={cn(
                          "w-4 h-4 flex-shrink-0",
                          light ? "text-primary-600" : "text-primary-400"
                        )} />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className={cn("text-lg", light ? "text-red-500" : "text-red-400")}>{error}</p>
      )}
    </div>
  );
}

export default SearchableSelect;
