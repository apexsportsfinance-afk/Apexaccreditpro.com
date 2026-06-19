import { describe, it, expect } from "vitest";
import {
  calculateAge,
  generateBadgeNumber,
  getBadgePrefix,
  validatePhoneForCountry,
  getCountryCode3,
  validateFile,
  getDialCode,
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
});

describe("getDialCode", () => {
  it("returns empty string for an unknown country", () => {
    expect(getDialCode("Atlantis")).toBe("");
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
