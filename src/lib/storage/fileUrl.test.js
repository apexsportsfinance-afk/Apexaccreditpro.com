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

import {
  resolveFileUrl,
  getPublicFileUrl,
  isPrivateStorageEnabled,
  parseStorageRef,
} from "./fileUrl";

const PUBLIC_URL =
  "https://proj.supabase.co/storage/v1/object/public/accreditation-files/registrations/ab.jpg";
const SIGN_URL =
  "https://proj.supabase.co/storage/v1/object/sign/photos/events/x.png?token=abc";
const EXTERNAL_URL = "https://flagcdn.com/w20/eg.png";

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

  it("flag OFF: returns a stored absolute URL verbatim (legacy data unchanged)", async () => {
    expect(await resolveFileUrl(PUBLIC_URL)).toBe(PUBLIC_URL);
    expect(await resolveFileUrl(EXTERNAL_URL)).toBe(EXTERNAL_URL);
  });

  it("flag ON: signs a legacy stored PUBLIC url by its extracted bucket+path", async () => {
    vi.stubEnv("VITE_PRIVATE_STORAGE", "true");
    const url = await resolveFileUrl(PUBLIC_URL);
    expect(url).toBe(
      "https://signed.example/accreditation-files/registrations/ab.jpg?exp=3600",
    );
  });

  it("flag ON: passes external (non-storage) URLs through untouched", async () => {
    vi.stubEnv("VITE_PRIVATE_STORAGE", "true");
    expect(await resolveFileUrl(EXTERNAL_URL)).toBe(EXTERNAL_URL);
  });
});

describe("parseStorageRef", () => {
  it("treats a bare value as an in-bucket path on the default bucket", () => {
    expect(parseStorageRef("registrations/ab.jpg")).toEqual({
      bucket: "accreditation-files",
      path: "registrations/ab.jpg",
    });
  });

  it("extracts bucket + path from a public storage URL", () => {
    expect(parseStorageRef(PUBLIC_URL)).toEqual({
      bucket: "accreditation-files",
      path: "registrations/ab.jpg",
    });
  });

  it("extracts bucket + path from a signed URL, dropping the query string", () => {
    expect(parseStorageRef(SIGN_URL)).toEqual({
      bucket: "photos",
      path: "events/x.png",
    });
  });

  it("returns null for external URLs and empty input", () => {
    expect(parseStorageRef(EXTERNAL_URL)).toBe(null);
    expect(parseStorageRef("")).toBe(null);
  });
});
