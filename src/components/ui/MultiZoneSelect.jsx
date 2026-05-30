import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, X } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * Multi-zone checkbox selector that stores comma-separated zone codes.
 * 
 * Props:
 *   - zones: Array of { code, name, color, description }
 *   - value: string — comma-separated zone codes, e.g. "A,B,C"
 *   - onChange: (newValue: string) => void
 *   - label?: string
 *   - required?: boolean
 *   - error?: string
 *   - placeholder?: string
 */
export default function MultiZoneSelect({
  zones = [],
  value = "",
  onChange,
  label,
  required,
  error,
  placeholder = "Select zone access..."
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse the current comma-separated value into an array
  const selectedCodes = value
    ? value.split(",").map(c => c.trim()).filter(Boolean)
    : [];

  const allCodes = zones.map(z => z.code);
  const allSelected = allCodes.length > 0 && allCodes.every(c => selectedCodes.includes(c));

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleZone = (code) => {
    let newCodes;
    if (selectedCodes.includes(code)) {
      newCodes = selectedCodes.filter(c => c !== code);
    } else {
      newCodes = [...selectedCodes, code];
    }
    onChange(newCodes.join(","));
  };

  const toggleAll = () => {
    if (allSelected) {
      onChange("");
    } else {
      onChange(allCodes.join(","));
    }
  };

  const removeZone = (code, e) => {
    e.stopPropagation();
    const newCodes = selectedCodes.filter(c => c !== code);
    onChange(newCodes.join(","));
  };

  const getZoneInfo = (code) => zones.find(z => z.code === code);

  // Display label
  const getDisplayContent = () => {
    if (selectedCodes.length === 0) {
      return <span className="text-slate-500">{placeholder}</span>;
    }
    if (allSelected && zones.length > 1) {
      return (
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 rounded text-xs font-semibold border border-cyan-500/30">
            ALL ZONES
          </span>
          <span className="text-slate-400 text-xs">({zones.length} zones)</span>
        </div>
      );
    }
    return (
      <div className="flex flex-wrap gap-1.5">
        {selectedCodes.slice(0, 5).map(code => {
          const zone = getZoneInfo(code);
          return (
            <span
              key={code}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border"
              style={{
                backgroundColor: zone?.color ? `${zone.color}20` : "rgba(59,130,246,0.2)",
                borderColor: zone?.color ? `${zone.color}50` : "rgba(59,130,246,0.3)",
                color: zone?.color || "#60a5fa"
              }}
            >
              {code}
              <button
                type="button"
                onClick={(e) => removeZone(code, e)}
                className="hover:opacity-70 ml-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          );
        })}
        {selectedCodes.length > 5 && (
          <span className="text-xs text-slate-400">+{selectedCodes.length - 5} more</span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-1.5" ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-slate-300">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
      )}

      <div className="relative">
        {/* Trigger */}
        <div
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-full min-h-[42px] px-3 py-2 rounded-lg cursor-pointer transition-colors duration-200",
            "flex items-center justify-between gap-2",
            "bg-slate-800/50 border text-white",
            isOpen ? "ring-2 ring-primary-500/50 border-primary-500" : "border-slate-700",
            error ? "border-red-500 ring-red-500/50" : ""
          )}
        >
          <div className="flex-1 min-w-0">{getDisplayContent()}</div>
          <ChevronDown className={cn(
            "w-5 h-5 text-slate-400 transition-transform flex-shrink-0",
            isOpen && "rotate-180"
          )} />
        </div>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 rounded-lg border bg-slate-800 border-slate-700 shadow-xl overflow-hidden"
            style={{ maxHeight: "280px" }}
          >
            {/* Select All */}
            <div
              onClick={toggleAll}
              className={cn(
                "px-4 py-3 cursor-pointer flex items-center justify-between border-b border-slate-700 transition-colors",
                allSelected
                  ? "bg-cyan-500/20 text-cyan-300"
                  : "hover:bg-slate-700 text-slate-200"
              )}
            >
              <span className="text-sm font-semibold">
                {allSelected ? "Deselect All Zones" : "Select All Zones"}
              </span>
              {allSelected && <Check className="w-4 h-4 text-cyan-400" />}
            </div>

            {/* Zone list */}
            <div className="overflow-y-auto" style={{ maxHeight: "220px" }}>
              {zones.length === 0 ? (
                <div className="px-4 py-4 text-center text-sm text-slate-400">
                  No zones configured for this event
                </div>
              ) : (
                zones.map((zone) => {
                  const isSelected = selectedCodes.includes(zone.code);
                  return (
                    <div
                      key={zone.code}
                      onClick={() => toggleZone(zone.code)}
                      className={cn(
                        "px-4 py-2.5 cursor-pointer flex items-center gap-3 transition-colors",
                        isSelected
                          ? "bg-primary-500/15 text-white"
                          : "hover:bg-slate-700 text-slate-200"
                      )}
                    >
                      {/* Checkbox */}
                      <div className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                        isSelected
                          ? "border-cyan-500 bg-cyan-500"
                          : "border-slate-500 bg-transparent"
                      )}>
                        {isSelected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                      </div>

                      {/* Zone color badge */}
                      <div
                        className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 shadow-sm"
                        style={{ backgroundColor: zone.color || "#3b82f6" }}
                      >
                        <span className="text-xs font-bold text-white">{zone.code}</span>
                      </div>

                      {/* Zone info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{zone.name}</p>
                        {zone.description && (
                          <p className="text-xs text-slate-400 truncate">{zone.description}</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {/* Selected count */}
      {selectedCodes.length > 0 && (
        <p className="text-xs text-slate-500">
          {selectedCodes.length} of {zones.length} zone{zones.length !== 1 ? "s" : ""} selected
        </p>
      )}
    </div>
  );
}
