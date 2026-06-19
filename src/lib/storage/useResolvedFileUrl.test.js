import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

// Mirror the supabase mock used by fileUrl.test so the hook (via the resolver)
// needs no real credentials. Both storage modules import "../supabase".
vi.mock("../supabase", () => {
  const from = (bucket) => ({
    getPublicUrl: (p) => ({ data: { publicUrl: `https://public.example/${bucket}/${p}` } }),
    createSignedUrl: async (p, exp) => ({
      data: { signedUrl: `https://signed.example/${bucket}/${p}?exp=${exp}` },
      error: null,
    }),
  });
  return { supabase: { storage: { from } } };
});

import { useResolvedFileUrl } from "./useResolvedFileUrl";

afterEach(() => vi.unstubAllEnvs());

describe("useResolvedFileUrl", () => {
  it("public mode: resolves synchronously on first render (no loading flash)", () => {
    const { result } = renderHook(() => useResolvedFileUrl("registrations/ab.jpg"));
    expect(result.current.loading).toBe(false);
    expect(result.current.url).toBe(
      "https://public.example/accreditation-files/registrations/ab.jpg",
    );
  });

  it("public mode: returns a stored absolute URL verbatim", () => {
    const stored =
      "https://proj.supabase.co/storage/v1/object/public/accreditation-files/registrations/ab.jpg";
    const { result } = renderHook(() => useResolvedFileUrl(stored));
    expect(result.current.loading).toBe(false);
    expect(result.current.url).toBe(stored);
  });

  it("private mode: starts loading, then resolves to a signed URL", async () => {
    vi.stubEnv("VITE_PRIVATE_STORAGE", "true");
    const { result } = renderHook(() => useResolvedFileUrl("registrations/ab.jpg"));
    expect(result.current.loading).toBe(true);
    expect(result.current.url).toBe(null);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.url).toBe(
      "https://signed.example/accreditation-files/registrations/ab.jpg?exp=3600",
    );
  });

  it("empty value: not loading, null url", () => {
    const { result } = renderHook(() => useResolvedFileUrl(null));
    expect(result.current.loading).toBe(false);
    expect(result.current.url).toBe(null);
  });
});
