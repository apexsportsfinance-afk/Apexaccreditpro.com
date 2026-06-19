import { describe, it, expect, vi, afterEach } from "vitest";

// Mock the Supabase client so the resolver (and the signedUrl helper it calls)
// never need real credentials. Both modules import "../supabase".
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

import { resolveFileUrl, getPublicFileUrl, isPrivateStorageEnabled } from "./fileUrl";

afterEach(() => vi.unstubAllEnvs());

describe("isPrivateStorageEnabled", () => {
  it("is false by default (public mode = today's behaviour)", () => {
    expect(isPrivateStorageEnabled()).toBe(false);
  });

  it("is true only when the flag is exactly 'true'", () => {
    vi.stubEnv("VITE_PRIVATE_STORAGE", "true");
    expect(isPrivateStorageEnabled()).toBe(true);
  });
});

describe("getPublicFileUrl", () => {
  it("returns the public URL for the default bucket", () => {
    expect(getPublicFileUrl("passports/a.jpg")).toBe(
      "https://public.example/accreditation-files/passports/a.jpg",
    );
  });

  it("honours an explicit bucket and tolerates empty input", () => {
    expect(getPublicFileUrl("x.png", { bucket: "photos" })).toBe(
      "https://public.example/photos/x.png",
    );
    expect(getPublicFileUrl("")).toBe(null);
    expect(getPublicFileUrl(null)).toBe(null);
  });
});

describe("resolveFileUrl", () => {
  it("returns a PUBLIC url when the flag is off (default — unchanged behaviour)", async () => {
    const url = await resolveFileUrl("passports/a.jpg");
    expect(url).toBe("https://public.example/accreditation-files/passports/a.jpg");
  });

  it("returns a SIGNED url when the private-storage flag is on", async () => {
    vi.stubEnv("VITE_PRIVATE_STORAGE", "true");
    const url = await resolveFileUrl("passports/a.jpg");
    expect(url).toContain("https://signed.example/accreditation-files/passports/a.jpg");
    expect(url).toContain("exp=");
  });

  it("returns null for empty input in either mode", async () => {
    expect(await resolveFileUrl("")).toBe(null);
    vi.stubEnv("VITE_PRIVATE_STORAGE", "true");
    expect(await resolveFileUrl(null)).toBe(null);
  });
});
