import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// Same Supabase mock shape as fileUrl.test.js so resolveFileUrl / signedUrl work
// without real credentials.
vi.mock("../supabase", () => {
  const from = (bucket) => ({
    getPublicUrl: (p) => ({ data: { publicUrl: `https://public.example/${bucket}/${p}` } }),
    createSignedUrl: async (p, exp) =>
      p.startsWith("fail/")
        ? { data: null, error: { message: "denied" } }
        : {
            data: { signedUrl: `https://signed.example/${bucket}/${p}?exp=${exp}` },
            error: null,
          },
  });
  return { supabase: { storage: { from } } };
});

import { openStoredFile } from "./openStoredFile";

afterEach(() => vi.unstubAllEnvs());

describe("openStoredFile", () => {
  let openSpy;

  beforeEach(() => {
    openSpy = vi.spyOn(window, "open").mockReturnValue(null);
  });

  afterEach(() => {
    openSpy.mockRestore();
  });

  it("does nothing for empty input", () => {
    openStoredFile("");
    openStoredFile(null);
    expect(openSpy).not.toHaveBeenCalled();
  });

  it("flag OFF: opens the public URL synchronously (unchanged behaviour)", () => {
    openStoredFile("passports/a.jpg");
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy).toHaveBeenCalledWith(
      "https://public.example/accreditation-files/passports/a.jpg",
      "_blank",
    );
  });

  it("flag OFF: opens a stored absolute URL verbatim", () => {
    const url =
      "https://proj.supabase.co/storage/v1/object/public/accreditation-files/x/y.pdf";
    openStoredFile(url);
    expect(openSpy).toHaveBeenCalledWith(url, "_blank");
  });

  it("flag ON: opens a blank tab synchronously, then redirects it to the signed URL", async () => {
    vi.stubEnv("VITE_PRIVATE_STORAGE", "true");
    const fakeWin = { location: { href: "" }, opener: {}, close: vi.fn() };
    openSpy.mockReturnValue(fakeWin);

    openStoredFile("passports/a.jpg");

    // Opened synchronously inside the gesture (blank target).
    expect(openSpy).toHaveBeenCalledWith("", "_blank");
    expect(fakeWin.opener).toBe(null);

    // Then redirected once the signed URL resolves.
    await vi.waitFor(() =>
      expect(fakeWin.location.href).toBe(
        "https://signed.example/accreditation-files/passports/a.jpg?exp=3600",
      ),
    );
  });

  it("flag ON: closes the placeholder tab if signing fails", async () => {
    vi.stubEnv("VITE_PRIVATE_STORAGE", "true");
    const fakeWin = { location: { href: "" }, opener: {}, close: vi.fn() };
    openSpy.mockReturnValue(fakeWin);

    // "fail/" path -> the signer returns null (e.g. RLS denial).
    openStoredFile("fail/secret.pdf");
    await vi.waitFor(() => expect(fakeWin.close).toHaveBeenCalled());
  });
});
