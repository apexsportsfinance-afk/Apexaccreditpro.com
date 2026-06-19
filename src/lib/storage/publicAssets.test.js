import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// Supabase mock: storage.getPublicUrl backs resolveFileUrlSync (public mode);
// functions.invoke backs the private-mode signing round-trip.
const invokeMock = vi.fn();
vi.mock("../supabase", () => {
  const from = (bucket) => ({
    getPublicUrl: (p) => ({ data: { publicUrl: `https://public.example/${bucket}/${p}` } }),
  });
  return { supabase: { storage: { from }, functions: { invoke: (...a) => invokeMock(...a) } } };
});

import { resolvePublicAssetUrls } from "./publicAssets";

afterEach(() => {
  vi.unstubAllEnvs();
  invokeMock.mockReset();
});

describe("resolvePublicAssetUrls", () => {
  it("returns {} for empty/blank input", async () => {
    expect(await resolvePublicAssetUrls([])).toEqual({});
    expect(await resolvePublicAssetUrls([null, "", undefined])).toEqual({});
    expect(invokeMock).not.toHaveBeenCalled();
  });

  describe("flag OFF (public mode, default)", () => {
    it("turns a bare path into a public URL and never calls the edge fn", async () => {
      const out = await resolvePublicAssetUrls(["registrations/a.jpg"]);
      expect(out).toEqual({
        "registrations/a.jpg": "https://public.example/accreditation-files/registrations/a.jpg",
      });
      expect(invokeMock).not.toHaveBeenCalled();
    });

    it("returns a stored absolute URL verbatim", async () => {
      const url = "https://proj.supabase.co/storage/v1/object/public/accreditation-files/x/y.jpg";
      const out = await resolvePublicAssetUrls([url]);
      expect(out[url]).toBe(url);
    });
  });

  describe("flag ON (private mode)", () => {
    beforeEach(() => vi.stubEnv("VITE_PRIVATE_STORAGE", "true"));

    it("sends normalized paths to the edge fn and maps signed URLs back by value", async () => {
      invokeMock.mockResolvedValue({
        data: { urls: { "registrations/a.jpg": "https://signed/a", "results/r.pdf": "https://signed/r" } },
        error: null,
      });
      const storedUrl =
        "https://proj.supabase.co/storage/v1/object/public/accreditation-files/results/r.pdf";

      const out = await resolvePublicAssetUrls(["registrations/a.jpg", storedUrl], {
        accreditationId: "acc-1",
        scope: "profile",
      });

      expect(invokeMock).toHaveBeenCalledTimes(1);
      const [name, { body }] = invokeMock.mock.calls[0];
      expect(name).toBe("public-verify-assets");
      expect(body.accreditationId).toBe("acc-1");
      expect(body.scope).toBe("profile");
      // Both values normalized to in-bucket paths.
      expect(body.paths.sort()).toEqual(["registrations/a.jpg", "results/r.pdf"]);

      expect(out["registrations/a.jpg"]).toBe("https://signed/a");
      expect(out[storedUrl]).toBe("https://signed/r");
    });

    it("passes external URLs through untouched and does not send them for signing", async () => {
      invokeMock.mockResolvedValue({ data: { urls: { "p/a.jpg": "https://signed/a" } }, error: null });
      const flag = "https://flagcdn.com/w160/ae.png";

      const out = await resolvePublicAssetUrls([flag, "p/a.jpg"], { eventId: "ev-1", scope: "branding" });

      const [, { body }] = invokeMock.mock.calls[0];
      expect(body.paths).toEqual(["p/a.jpg"]); // flag not included
      expect(out[flag]).toBe(flag); // untouched
      expect(out["p/a.jpg"]).toBe("https://signed/a");
    });

    it("yields null for a requested path the allowlist did not sign", async () => {
      invokeMock.mockResolvedValue({ data: { urls: {} }, error: null });
      const out = await resolvePublicAssetUrls(["secret/id.jpg"], { accreditationId: "acc-1" });
      expect(out["secret/id.jpg"]).toBeNull();
    });

    it("degrades gracefully (all null) when the edge fn errors", async () => {
      invokeMock.mockResolvedValue({ data: null, error: { message: "boom" } });
      const out = await resolvePublicAssetUrls(["p/a.jpg"], { accreditationId: "acc-1" });
      expect(out["p/a.jpg"]).toBeNull();
    });

    it("skips the network call entirely when every value is external", async () => {
      const out = await resolvePublicAssetUrls(["https://flagcdn.com/w160/ae.png"], { eventId: "ev" });
      expect(invokeMock).not.toHaveBeenCalled();
      expect(out["https://flagcdn.com/w160/ae.png"]).toBe("https://flagcdn.com/w160/ae.png");
    });
  });
});
