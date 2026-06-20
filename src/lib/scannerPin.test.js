import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// Supabase mock: functions.invoke backs the server-side (flag ON) check.
const invokeMock = vi.fn();
vi.mock("./supabase", () => ({
  supabase: { functions: { invoke: (...a) => invokeMock(...a) } },
}));

// GlobalSettingsAPI.get backs the client-side (flag OFF) event-PIN lookup.
const getSettingMock = vi.fn();
vi.mock("./broadcastApi", () => ({
  GlobalSettingsAPI: { get: (...a) => getSettingMock(...a) },
}));

import { verifyScannerPin, isServerScannerPinEnabled } from "./scannerPin";

afterEach(() => {
  vi.unstubAllEnvs();
  invokeMock.mockReset();
  getSettingMock.mockReset();
});

describe("verifyScannerPin — flag OFF (client comparison, default)", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_SERVER_SCANNER_PIN", "");
    vi.stubEnv("VITE_SCANNER_PIN", "9999");
  });

  it("reports the flag as disabled", () => {
    expect(isServerScannerPinEnabled()).toBe(false);
  });

  it("matches the event PIN from global_settings and never calls the edge fn", async () => {
    getSettingMock.mockResolvedValue("4321");
    expect(await verifyScannerPin("EV1", "4321")).toBe(true);
    expect(getSettingMock).toHaveBeenCalledWith("event_EV1_scanner_pin");
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("falls back to the global VITE_SCANNER_PIN when no event PIN matches", async () => {
    getSettingMock.mockResolvedValue(null);
    expect(await verifyScannerPin("EV1", "9999")).toBe(true);
  });

  it("rejects a wrong PIN, an empty PIN, and skips the lookup with no event", async () => {
    getSettingMock.mockResolvedValue("4321");
    expect(await verifyScannerPin("EV1", "0000")).toBe(false);
    expect(await verifyScannerPin("EV1", "")).toBe(false);
    expect(await verifyScannerPin(undefined, "9999")).toBe(true); // global fallback, no event lookup
  });

  it("propagates a settings-fetch error so the gate can show a Connection Error", async () => {
    getSettingMock.mockRejectedValue(new Error("network"));
    await expect(verifyScannerPin("EV1", "9999")).rejects.toThrow("network");
  });
});

describe("verifyScannerPin — flag ON (server verification)", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_SERVER_SCANNER_PIN", "true");
  });

  it("reports the flag as enabled", () => {
    expect(isServerScannerPinEnabled()).toBe(true);
  });

  it("returns the edge fn's verdict and never reads the PIN client-side", async () => {
    invokeMock.mockResolvedValue({ data: { valid: true }, error: null });
    expect(await verifyScannerPin("EV1", "4321")).toBe(true);
    expect(getSettingMock).not.toHaveBeenCalled();
    expect(invokeMock).toHaveBeenCalledWith("verify-scanner-pin", {
      body: { eventId: "EV1", pin: "4321" },
    });
  });

  it("fails closed on an edge-fn error response", async () => {
    invokeMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await verifyScannerPin("EV1", "4321")).toBe(false);
  });

  it("fails closed when the invoke call throws", async () => {
    invokeMock.mockRejectedValue(new Error("network down"));
    expect(await verifyScannerPin("EV1", "4321")).toBe(false);
  });

  it("still rejects an empty PIN before any network call", async () => {
    expect(await verifyScannerPin("EV1", "")).toBe(false);
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
