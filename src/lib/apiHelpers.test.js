import { describe, it, expect, vi, afterEach } from "vitest";
import { handleResponse, sleep } from "./apiHelpers";

describe("sleep", () => {
  it("resolves after the given delay", async () => {
    const start = Date.now();
    await sleep(15);
    expect(Date.now() - start).toBeGreaterThanOrEqual(10);
  });
});

describe("handleResponse", () => {
  it("returns data on a successful Supabase response", async () => {
    const result = await handleResponse(() => Promise.resolve({ data: { id: 1 }, error: null }));
    expect(result).toEqual({ id: 1 });
  });

  it("throws immediately (no retry) on non-retryable error codes", async () => {
    // PGRST116 (no rows) and 23505 (unique violation) must not be retried.
    await expect(
      handleResponse(() => Promise.resolve({ data: null, error: { code: "PGRST116" } }))
    ).rejects.toMatchObject({ code: "PGRST116" });

    await expect(
      handleResponse(() => Promise.resolve({ data: null, error: { code: "23505" } }))
    ).rejects.toMatchObject({ code: "23505" });
  });

  it("throws immediately on JWT/permission errors", async () => {
    await expect(
      handleResponse(() => Promise.resolve({ data: null, error: { code: "42501" } }))
    ).rejects.toMatchObject({ code: "42501" });
  });
});

describe("handleResponse retry behaviour", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries a transient (retryable) error then succeeds", async () => {
    vi.useFakeTimers();
    const factory = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { code: "XYZ", message: "transient" } })
      .mockResolvedValueOnce({ data: { ok: 1 }, error: null });

    const p = handleResponse(factory);
    await vi.advanceTimersByTimeAsync(1000); // first backoff: RETRY_DELAY * 1
    await expect(p).resolves.toEqual({ ok: 1 });
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it("gives up after MAX_RETRIES on a persistent retryable error", async () => {
    vi.useFakeTimers();
    const factory = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: "XYZ", message: "still broken" } });

    const p = handleResponse(factory);
    const assertion = expect(p).rejects.toMatchObject({ code: "XYZ" });
    await vi.advanceTimersByTimeAsync(1000 + 2000); // backoffs for attempts 1 and 2
    await assertion;
    expect(factory).toHaveBeenCalledTimes(3);
  });

  it("retries an offline network error, signals apx-network-error, then rethrows", async () => {
    vi.useFakeTimers();
    const onlineDesc = Object.getOwnPropertyDescriptor(window.navigator, "onLine");
    Object.defineProperty(window.navigator, "onLine", { value: false, configurable: true });
    const handler = vi.fn();
    window.addEventListener("apx-network-error", handler);

    const err = new TypeError("Failed to fetch");
    const factory = vi.fn().mockRejectedValue(err);

    const p = handleResponse(factory);
    const assertion = expect(p).rejects.toBe(err);
    await vi.advanceTimersByTimeAsync(1000 + 2000);
    await assertion;

    expect(factory).toHaveBeenCalledTimes(3);
    expect(handler).toHaveBeenCalledTimes(1);

    window.removeEventListener("apx-network-error", handler);
    if (onlineDesc) Object.defineProperty(window.navigator, "onLine", onlineDesc);
  });
});
