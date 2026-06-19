import { describe, it, expect } from "vitest";
import { computeExpiryStatus, formatEventDateTime } from "./expiryUtils";

describe("computeExpiryStatus", () => {
  it("returns Valid for null input", () => {
    const r = computeExpiryStatus(null);
    expect(r.isExpired).toBe(false);
    expect(r.status).toBe("Valid");
  });

  it("treats force_live as a permanent override", () => {
    const r = computeExpiryStatus({ force_live: true, selected_events: [{ date: "2000-01-01" }] });
    expect(r.isExpired).toBe(false);
    expect(r.label).toMatch(/Override/);
  });

  it("uses the latest event date and flags past dates as expired", () => {
    expect(computeExpiryStatus({ selected_events: [{ date: "2999-01-01" }] }).isExpired).toBe(false);
    expect(computeExpiryStatus({ selected_events: [{ date: "2000-01-01" }] }).isExpired).toBe(true);
  });

  it("picks the latest of several event dates", () => {
    const r = computeExpiryStatus({
      selected_events: [{ date: "2000-01-01" }, { date: "2999-01-01" }],
    });
    expect(r.isExpired).toBe(false);
    expect(r.expiryDate).toBe("2999-01-01");
  });

  it("falls back to expiry_date when no event dates exist", () => {
    expect(computeExpiryStatus({ expiry_date: "2999-01-01" }).isExpired).toBe(false);
    expect(computeExpiryStatus({ expiry_date: "2000-01-01" }).isExpired).toBe(true);
  });

  it("defaults to Valid when no expiry data is present", () => {
    expect(computeExpiryStatus({ selected_events: [] }).status).toBe("Valid");
  });
});

describe("formatEventDateTime", () => {
  it("joins the available parts with a separator", () => {
    const out = formatEventDateTime({
      date: "2025-06-15",
      startTime: "10:00",
      session: "A",
      venue: "Main Pool",
    });
    expect(out).toContain("2025");
    expect(out).toContain("10:00");
    expect(out).toContain("Session A");
    expect(out).toContain("Main Pool");
    expect(out).toContain(" · ");
  });

  it("omits missing parts gracefully", () => {
    expect(formatEventDateTime({ venue: "Hall B" })).toBe("Hall B");
    expect(formatEventDateTime({})).toBe("");
  });
});
