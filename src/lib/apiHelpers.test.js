import { describe, it, expect } from "vitest";
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
