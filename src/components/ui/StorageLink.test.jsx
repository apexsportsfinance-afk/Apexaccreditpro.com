import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

// Same supabase mock used by the storage tests; the component resolves through
// the storage layer which imports "../../lib/supabase".
vi.mock("../../lib/supabase", () => {
  const from = (bucket) => ({
    getPublicUrl: (p) => ({ data: { publicUrl: `https://public.example/${bucket}/${p}` } }),
    createSignedUrl: async (p, exp) => ({
      data: { signedUrl: `https://signed.example/${bucket}/${p}?exp=${exp}` },
      error: null,
    }),
  });
  return { supabase: { storage: { from } } };
});

import StorageLink from "./StorageLink";
import StorageImage from "./StorageImage";

afterEach(() => vi.unstubAllEnvs());

describe("StorageLink", () => {
  it("public mode: renders an <a> with the resolved href + forwards props", () => {
    render(
      <StorageLink href="docs/id.pdf" target="_blank" data-testid="lnk">
        open
      </StorageLink>,
    );
    const a = screen.getByTestId("lnk");
    expect(a.tagName).toBe("A");
    expect(a.getAttribute("href")).toBe("https://public.example/accreditation-files/docs/id.pdf");
    expect(a.getAttribute("target")).toBe("_blank");
  });

  it("private mode: resolves the href to a signed URL", async () => {
    vi.stubEnv("VITE_PRIVATE_STORAGE", "true");
    render(
      <StorageLink href="docs/id.pdf" data-testid="lnk">
        open
      </StorageLink>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("lnk").getAttribute("href")).toBe(
        "https://signed.example/accreditation-files/docs/id.pdf?exp=3600",
      ),
    );
  });
});

describe("StorageImage", () => {
  it("public mode: renders an <img> with the resolved src", () => {
    render(<StorageImage src="photos/a.jpg" alt="x" data-testid="img" />);
    const img = screen.getByTestId("img");
    expect(img.tagName).toBe("IMG");
    expect(img.getAttribute("src")).toBe("https://public.example/accreditation-files/photos/a.jpg");
  });
});
