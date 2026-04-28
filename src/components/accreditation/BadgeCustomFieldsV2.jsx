import React from 'react';

/**
 * Dedicated component for rendering custom fields on the badge.
 * Extracted to avoid module caching issues and ensure stable rendering.
 */
export const BadgeCustomFields = ({ accreditation, customFieldConfigs = [], cardFont = {} }) => {
  // Deep Refresh V2 - Forced Code Update
  if (!customFieldConfigs || customFieldConfigs.length === 0) return null;

  return (
    <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px", width: "100%", alignItems: "flex-end" }}>
      {customFieldConfigs
        ?.filter(cfg => cfg.showOnBadge === true)
        ?.map(cfg => {
          const value = accreditation?.customFields?.[cfg.id];
          if (!value) return null;
          return (
            <div 
              key={cfg.id}
              style={{ 
                padding: "2px 0",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                minWidth: "120px",
                ...cardFont,
                boxSizing: "border-box"
              }}
            >
              <div style={{ fontSize: "7px", fontWeight: "bold", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.02em", marginBottom: "1px", width: "100%", textAlign: "center" }}>
                {cfg.label}
              </div>
              <div style={{ fontSize: "11px", fontWeight: "900", color: "#1e293b", textTransform: "uppercase", width: "100%", textAlign: "center", lineHeight: "1" }}>
                {value}
              </div>
            </div>
          );
        })}
    </div>
  );
};
