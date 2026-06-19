import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// storage.getPublicUrl backs the public-mode seed; functions.invoke backs the
// private-mode signing round-trip.
const invokeMock = vi.fn();
vi.mock("../supabase", () => {
  const from = (bucket) => ({
    getPublicUrl: (p) => ({ data: { publicUrl: `https://public.example/${bucket}/${p}` } }),
  });
  return { supabase: { storage: { from }, functions: { invoke: (...a) => invokeMock(...a) } } };
});

import { usePublicAssetUrls } from "./publicAssets";

afterEach(() => {
  vi.unstubAllEnvs();
  invokeMock.mockReset();
});

describe("usePublicAssetUrls", () => {
  it("public mode: seeds public URLs synchronously, keyed by value, no loading", () => {
    const { result } = renderHook(() =>
      usePublicAssetUrls(["registrations/a.jpg"], { accreditationId: "acc-1" })
    );
    expect(result.current.loading).toBe(false);
    expect(result.current.urls["registrations/a.jpg"]).toBe(
      "https://public.example/accreditation-files/registrations/a.jpg"
    );
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("empty values: not loading, empty map, no network", () => {
    const { result } = renderHook(() => usePublicAssetUrls([], { eventId: "ev-1" }));
    expect(result.current.loading).toBe(false);
    expect(result.current.urls).toEqual({});
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("private mode: starts loading, then resolves signed URLs keyed by value", async () => {
    vi.stubEnv("VITE_PRIVATE_STORAGE", "true");
    invokeMock.mockResolvedValue({
      data: { urls: { "registrations/a.jpg": "https://signed/a" } },
      error: null,
    });

    const { result } = renderHook(() =>
      usePublicAssetUrls(["registrations/a.jpg"], { accreditationId: "acc-1", scope: "profile" })
    );

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.urls["registrations/a.jpg"]).toBe("https://signed/a");

    const [name, { body }] = invokeMock.mock.calls[0];
    expect(name).toBe("public-verify-assets");
    expect(body).toMatchObject({ accreditationId: "acc-1", scope: "profile", paths: ["registrations/a.jpg"] });
  });

  it("private mode: external URLs pass through without a network call", async () => {
    vi.stubEnv("VITE_PRIVATE_STORAGE", "true");
    const flag = "https://flagcdn.com/w160/ae.png";
    const { result } = renderHook(() => usePublicAssetUrls([flag], { eventId: "ev-1", scope: "branding" }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.urls[flag]).toBe(flag);
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
