import { describe, it, expect } from "vitest";
import {
  computeAccreditationLineItems,
  buildPriceMap,
  buildSpectatorLineItems,
} from "./pricing";

// Server-side price-authority contract for create-payment-session. These pin the
// money math (the board's Critical-untested billing path): amounts are always
// derived from server/DB data, quantities and per-day factors are clamped, and
// unknown items are rejected. A regression here silently mis-charges customers.

describe("computeAccreditationLineItems", () => {
  it("prices from the invite link and converts to integer minor units (fils)", () => {
    const out = computeAccreditationLineItems(
      { requirePayment: true, paymentAmount: 50 },
      { eventSlug: "summer-cup", customerName: "Jane Doe" },
    );
    expect(out).toHaveLength(1);
    expect(out[0].quantity).toBe(1);
    expect(out[0].price_data.currency).toBe("aed");
    expect(out[0].price_data.unit_amount).toBe(5000);
    expect(out[0].price_data.product_data.name).toContain("summer-cup");
    expect(out[0].price_data.product_data.description).toContain("Jane Doe");
  });

  it("rounds fractional amounts to the nearest fils", () => {
    const out = computeAccreditationLineItems(
      { requirePayment: true, paymentAmount: 49.99 },
      {},
    );
    expect(out[0].price_data.unit_amount).toBe(4999);
  });

  it("coerces a string amount", () => {
    const out = computeAccreditationLineItems({ requirePayment: true, paymentAmount: "75" }, {});
    expect(out[0].price_data.unit_amount).toBe(7500);
  });

  it("throws when the link does not require payment", () => {
    expect(() => computeAccreditationLineItems({ requirePayment: false, paymentAmount: 50 }, {}))
      .toThrow(/does not require payment/);
  });

  it("throws on zero or negative configured amounts", () => {
    expect(() => computeAccreditationLineItems({ requirePayment: true, paymentAmount: 0 }, {}))
      .toThrow(/does not require payment/);
    expect(() => computeAccreditationLineItems({ requirePayment: true, paymentAmount: -10 }, {}))
      .toThrow(/does not require payment/);
  });
});

describe("buildPriceMap", () => {
  it("merges ticket types and packages, coercing price and the full-event flag", () => {
    const map = buildPriceMap(
      [{ id: "t1", price: "20", is_full_event: false }],
      [{ id: "p1", price: 100, is_full_event: true }],
    );
    expect(map.get("t1")).toEqual({ price: 20, isFullEvent: false });
    expect(map.get("p1")).toEqual({ price: 100, isFullEvent: true });
  });

  it("treats null inputs as empty", () => {
    expect(buildPriceMap(null, null).size).toBe(0);
  });

  it("defaults a missing is_full_event to false", () => {
    const map = buildPriceMap([{ id: "t1", price: 10 }], null);
    expect(map.get("t1")?.isFullEvent).toBe(false);
  });
});

describe("buildSpectatorLineItems", () => {
  const priceMap = buildPriceMap(
    [{ id: "day", price: 10, is_full_event: false }],
    [{ id: "full", price: 100, is_full_event: true }],
  );

  it("re-prices a per-day ticket by quantity and day factor", () => {
    const [li] = buildSpectatorLineItems([{ id: "day", quantity: 2, dayFactor: 3 }], priceMap);
    expect(li.quantity).toBe(2);
    expect(li.price_data.unit_amount).toBe(3000); // 10 * 3 days * 100
  });

  it("ignores the day factor for full-event tickets", () => {
    const [li] = buildSpectatorLineItems([{ id: "full", quantity: 1, dayFactor: 5 }], priceMap);
    expect(li.price_data.unit_amount).toBe(10000); // 100 * 1 * 100
  });

  it("clamps quantity to [1,100] and tolerates junk", () => {
    expect(buildSpectatorLineItems([{ id: "day", quantity: 0 }], priceMap)[0].quantity).toBe(1);
    expect(buildSpectatorLineItems([{ id: "day", quantity: 150 }], priceMap)[0].quantity).toBe(100);
    expect(buildSpectatorLineItems([{ id: "day", quantity: -5 }], priceMap)[0].quantity).toBe(1);
    expect(buildSpectatorLineItems([{ id: "day", quantity: "abc" }], priceMap)[0].quantity).toBe(1);
  });

  it("clamps the day factor to [1,60] for per-day tickets", () => {
    expect(buildSpectatorLineItems([{ id: "day", dayFactor: 100 }], priceMap)[0].price_data.unit_amount).toBe(60000); // 10 * 60 * 100
    expect(buildSpectatorLineItems([{ id: "day", dayFactor: 0 }], priceMap)[0].price_data.unit_amount).toBe(1000); // 10 * 1 * 100
  });

  it("rejects an unknown ticket id (never trusts a client item not in the map)", () => {
    expect(() => buildSpectatorLineItems([{ id: "ghost" }], priceMap))
      .toThrow(/Unknown ticket item: ghost/);
  });

  it("throws when no items are provided", () => {
    expect(() => buildSpectatorLineItems([], priceMap)).toThrow(/No items provided/);
  });

  it("defaults the display name and description", () => {
    const [li] = buildSpectatorLineItems([{ id: "day" }], priceMap);
    expect(li.price_data.product_data.name).toBe("Ticket");
    expect(li.price_data.product_data.description).toBe("");
  });
});
