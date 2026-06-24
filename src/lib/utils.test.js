import { describe, it, expect } from "vitest";
import {
  calculateAge,
  generateBadgeNumber,
  getBadgePrefix,
  validatePhoneForCountry,
  getCountryCode3,
  getCountryName,
  getCountryFlag,
  validateFile,
  getDialCode,
  isExpired,
  getExpirationLabel,
  formatDate,
  cn,
} from "./utils";

describe("calculateAge", () => {
  it("computes age at end of the given year", () => {
    expect(calculateAge("2000-06-15", 2020)).toBe(20);
  });
  it("returns null for missing or invalid input", () => {
    expect(calculateAge(null)).toBeNull();
    expect(calculateAge("not-a-date")).toBeNull();
  });
});

describe("generateBadgeNumber", () => {
  it("maps known roles to a prefix and zero-pads the index", () => {
    expect(generateBadgeNumber("athlete", 5)).toBe("ATH-005");
    expect(generateBadgeNumber("ATHLETE", 1)).toBe("ATH-001"); // case-insensitive
    expect(generateBadgeNumber("media", 123)).toBe("MED-123");
  });
  it("falls back to GEN for unknown roles", () => {
    expect(generateBadgeNumber("wizard", 7)).toBe("GEN-007");
  });
});

describe("getBadgePrefix", () => {
  it("uses the role-prefix table", () => {
    expect(getBadgePrefix("Referee")).toBe("REF");
    expect(getBadgePrefix("Athlete")).toBe("ATH");
  });
  it("honors a custom prefix override", () => {
    expect(getBadgePrefix("Athlete", "CUSTOM")).toBe("CUSTOM");
  });
  it("derives a 3-letter prefix for unknown roles", () => {
    expect(getBadgePrefix("Plumber")).toBe("PLU");
  });
});

describe("validatePhoneForCountry", () => {
  it("treats empty as valid (optional field)", () => {
    expect(validatePhoneForCountry("", "UAE")).toBeNull();
    expect(validatePhoneForCountry("   ", "UAE")).toBeNull();
  });
  it("accepts international and local formats", () => {
    expect(validatePhoneForCountry("+971501234567", "UAE")).toBeNull();
    expect(validatePhoneForCountry("050 123 4567", "UAE")).toBeNull();
  });
  it("rejects too-short and too-long numbers", () => {
    expect(validatePhoneForCountry("123", "UAE")).toMatch(/valid phone/i);
    expect(validatePhoneForCountry("1234567890123456", "UAE")).toMatch(/valid phone/i);
  });
});

describe("getCountryCode3", () => {
  it("returns empty string for empty input", () => {
    expect(getCountryCode3("")).toBe("");
  });
  it("passes through an unknown code unchanged", () => {
    expect(getCountryCode3("ZZ")).toBe("ZZ");
  });
  it("resolves a known country by alpha-2 code, name, or IOC code", () => {
    expect(getCountryCode3("ae")).toBe("UAE"); // alpha-2, case-insensitive
    expect(getCountryCode3("United Arab Emirates")).toBe("UAE"); // by name
    expect(getCountryCode3("UAE")).toBe("UAE"); // already an IOC code
    expect(getCountryCode3("EGY")).toBe("EGY"); // IOC -> IOC
  });
});

describe("getCountryName", () => {
  it("returns empty string for empty input", () => {
    expect(getCountryName("")).toBe("");
  });
  it("resolves a known country and passes unknown codes through", () => {
    expect(getCountryName("AE")).toBe("United Arab Emirates");
    expect(getCountryName("EGY")).toBe("Egypt");
    expect(getCountryName("ZZ")).toBe("ZZ");
  });
});

describe("getCountryFlag", () => {
  it("returns null for empty or unknown codes and a flagcdn URL for known ones", () => {
    expect(getCountryFlag("")).toBeNull();
    expect(getCountryFlag("ZZ")).toBeNull();
    expect(getCountryFlag("AE")).toBe("https://flagcdn.com/w80/ae.png");
  });
});

describe("getDialCode", () => {
  it("returns empty string for an unknown country", () => {
    expect(getDialCode("Atlantis")).toBe("");
  });
  it("returns the international dial code for a known country", () => {
    expect(getDialCode("United Arab Emirates")).toBe("+971");
    expect(getDialCode("United States")).toBe("+1");
  });
});

describe("isExpired", () => {
  it("treats a missing date as not expired (open-ended accreditation)", () => {
    expect(isExpired(null)).toBe(false);
    expect(isExpired(undefined)).toBe(false);
  });
  it("is true only for past dates", () => {
    expect(isExpired("2000-01-01")).toBe(true);
    expect(isExpired("2999-01-01")).toBe(false);
  });
});

describe("getExpirationLabel", () => {
  it("labels a missing date as Never and a past date as Expired", () => {
    expect(getExpirationLabel(null)).toBe("Never");
    expect(getExpirationLabel("2000-01-01")).toBe("Expired");
  });
  it("buckets remaining time into months / days / hours", () => {
    // Offsets are padded a little so execution time can't shave the value into
    // the next-lower bucket; assertions check the bucket, not an exact count.
    const inDays = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();
    expect(getExpirationLabel(inDays(90))).toMatch(/ mos$/);
    expect(getExpirationLabel(inDays(5))).toMatch(/ days$/);
    const inHours = (n) => new Date(Date.now() + n * 60 * 60 * 1000).toISOString();
    expect(getExpirationLabel(inHours(5))).toMatch(/ hrs$/);
  });
});

describe("formatDate", () => {
  it("returns N/A for empty input", () => {
    expect(formatDate("")).toBe("N/A");
  });
  it("formats with the short and long month patterns", () => {
    // Noon local time (no trailing Z) so the calendar day is timezone-stable.
    expect(formatDate("2026-03-09T12:00:00", "MMM dd, yyyy")).toBe("Mar 09, 2026");
    expect(formatDate("2026-03-09T12:00:00", "MMMM dd, yyyy")).toBe("March 09, 2026");
  });
});

describe("validateFile", () => {
  it("accepts allowed types within the size limit", () => {
    expect(validateFile({ type: "image/png", size: 1024 })).toEqual({ valid: true });
  });
  it("rejects disallowed types", () => {
    expect(validateFile({ type: "text/plain", size: 10 }).valid).toBe(false);
  });
  it("rejects files over the size limit", () => {
    expect(validateFile({ type: "image/png", size: 6 * 1024 * 1024 }, 5).valid).toBe(false);
  });
});

describe("cn", () => {
  it("joins truthy class names and drops falsy ones", () => {
    expect(cn("a", false && "b", "c")).toContain("a");
    expect(cn("a", false && "b", "c")).toContain("c");
    expect(cn("a", null, undefined, "c")).not.toContain("null");
  });
});
