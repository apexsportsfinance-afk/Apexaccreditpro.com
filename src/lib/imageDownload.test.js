import { describe, it, expect, vi, afterEach } from "vitest";

// imageDownload imports the supabase client + the storage resolver at load; stub
// supabase, and drive resolveFileUrl via the same getPublicUrl/createSignedUrl mock
// shape the other storage tests use.
vi.mock("./supabase", () => {
  const from = (bucket) => ({
    getPublicUrl: (p) => ({ data: { publicUrl: `https://public.example/${bucket}/${p}` } }),
    createSignedUrl: async (p, exp) => ({
      data: { signedUrl: `https://signed.example/${bucket}/${p}?exp=${exp}` },
      error: null,
    }),
  });
  return { supabase: { storage: { from } } };
});

import { getExtFromUrl, toFetchableUrl } from "./imageDownload";

afterEach(() => vi.unstubAllEnvs());

describe("getExtFromUrl", () => {
  it("defaults to jpg for empty input", () => {
    expect(getExtFromUrl("")).toBe("jpg");
    expect(getExtFromUrl(null)).toBe("jpg");
    expect(getExtFromUrl(undefined)).toBe("jpg");
  });

  describe("data URLs", () => {
    it("detects png / webp / pdf by mime", () => {
      expect(getExtFromUrl("data:image/png;base64,AAAA")).toBe("png");
      expect(getExtFromUrl("data:image/webp;base64,AAAA")).toBe("webp");
      expect(getExtFromUrl("data:application/pdf;base64,AAAA")).toBe("pdf");
    });
    it("falls back to jpg for other/unknown data mimes", () => {
      expect(getExtFromUrl("data:image/jpeg;base64,AAAA")).toBe("jpg");
      expect(getExtFromUrl("data:image/gif;base64,AAAA")).toBe("jpg");
    });
  });

  describe("remote URLs", () => {
    it("reads a known extension from the path", () => {
      expect(getExtFromUrl("https://x/y/photo.png")).toBe("png");
      expect(getExtFromUrl("https://x/y/doc.pdf")).toBe("pdf");
      expect(getExtFromUrl("https://x/y/img.webp")).toBe("webp");
    });
    it("normalizes jpeg -> jpg", () => {
      expect(getExtFromUrl("https://x/y/img.jpeg")).toBe("jpg");
    });
    it("is case-insensitive on the extension", () => {
      expect(getExtFromUrl("https://x/y/IMG.PNG")).toBe("png");
    });
    it("strips a query string before reading the extension (signed URLs)", () => {
      expect(getExtFromUrl("https://x/y/photo.png?token=abc.def&exp=3600")).toBe("png");
    });
    it("falls back to jpg for unknown/extensionless paths", () => {
      expect(getExtFromUrl("https://x/y/file.bmp")).toBe("jpg");
      expect(getExtFromUrl("https://x/y/noext")).toBe("jpg");
    });
  });
});

describe("toFetchableUrl", () => {
  it("passes empty and data: URLs through untouched", async () => {
    expect(await toFetchableUrl("")).toBe("");
    expect(await toFetchableUrl(null)).toBe(null);
    const dataUrl = "data:image/png;base64,AAAA";
    expect(await toFetchableUrl(dataUrl)).toBe(dataUrl);
  });

  it("public mode (flag off): returns a stored URL verbatim / a path as public URL", async () => {
    const stored = "https://proj.supabase.co/storage/v1/object/public/accreditation-files/a/b.jpg";
    expect(await toFetchableUrl(stored)).toBe(stored);
    expect(await toFetchableUrl("registrations/a.jpg")).toBe(
      "https://public.example/accreditation-files/registrations/a.jpg"
    );
  });

  it("private mode (flag on): signs a stored bucket URL so the cross-origin fetch can succeed", async () => {
    vi.stubEnv("VITE_PRIVATE_STORAGE", "true");
    const stored = "https://proj.supabase.co/storage/v1/object/public/accreditation-files/a/b.jpg";
    expect(await toFetchableUrl(stored)).toBe(
      "https://signed.example/accreditation-files/a/b.jpg?exp=3600"
    );
  });
});
