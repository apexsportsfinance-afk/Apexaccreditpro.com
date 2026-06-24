import React, { useMemo } from "react";
import { Check } from "lucide-react";

function ZoneAccessSelector({ zones, selectedRole, selectedCodes, onToggle, onSelectAll, onClearAll }) {
  const roleZones = useMemo(() => {
    if (!selectedRole || zones.length === 0) return zones;
    const filtered = zones.filter(z => {
      const ar = z.allowedRoles || [];
      return ar.length === 0 || ar.includes(selectedRole);
    });
    return filtered.length > 0 ? filtered : zones;
  }, [zones, selectedRole]);

  const hasRoleFilter = selectedRole && roleZones.length < zones.length;

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-2">
        {hasRoleFilter && (
          <p className="text-lg text-cyan-400 font-extralight">
            Showing {roleZones.length} zone(s) linked to role <span className="font-medium">{selectedRole}</span>
          </p>
        )}
        <div className="flex gap-2 ml-auto">
          <button type="button" onClick={() => onSelectAll(roleZones)} className="text-lg text-cyan-400 hover:text-cyan-300">
            Select Shown
          </button>
          <span className="text-slate-600">|</span>
          <button type="button" onClick={onClearAll} className="text-lg text-slate-400 hover:text-slate-300">
            Clear
          </button>
          {hasRoleFilter && (
            <>
              <span className="text-slate-600">|</span>
              <button type="button" onClick={() => onSelectAll(zones)} className="text-lg text-slate-500 hover:text-slate-300">
                All zones
              </button>
            </>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {roleZones.map(zone => {
          const isSelected = selectedCodes.includes(zone.code);
          return (
            <button
              key={zone.id}
              type="button"
              onClick={() => onToggle(zone.code)}
              className={`p-3 rounded-lg border-2 transition-all duration-200 text-left ${isSelected
                  ? "border-primary-500 bg-primary-500/20"
                  : "border-slate-700 hover:border-slate-600 bg-slate-800/50"
                }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                  style={{ backgroundColor: zone.color || "#2563eb" }}
                >
                  {zone.code}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-lg font-medium truncate ${isSelected ? "text-white" : "text-slate-300"}`}>
                    {zone.name}
                  </p>
                </div>
                {isSelected && <Check className="w-4 h-4 text-primary-400 flex-shrink-0" />}
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-lg text-slate-500 font-extralight">
        {selectedCodes.length} zone(s) selected
      </p>
    </>
  );
}

export default ZoneAccessSelector;
