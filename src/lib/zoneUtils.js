// src/lib/zoneUtils.js

export const normalizeZoneCodes = (zoneCode) => {
  if (!zoneCode) return [];

  return [...new Set(
    zoneCode
      .split(",")
      .map(z => z.trim().toUpperCase())
      .filter(Boolean)
  )];
};
