import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Separate from vite.config.js so the production build config is never coupled
// to test config. Same `@` alias so imports resolve identically.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      xlsx: "@e965/xlsx",
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.js"],
    include: [
      "src/**/*.{test,spec}.{js,jsx}",
      "supabase/functions/**/*.{test,spec}.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**", "src/contexts/**"],
      exclude: ["src/**/*.{test,spec}.{js,jsx}", "src/test/**"],
      // Coverage gate. The global numbers are a RATCHET — they lock in the
      // current floor so coverage can only go up as the still-untested modules
      // (lib/api/*, contexts) get tests. The per-path bars enforce the
      // institutional "≥60% on critical paths" exit gate; those modules already
      // sit at 85–100%, so the bar is set just under current to allow minor
      // drift while preventing real regressions. Raise the global floor as the
      // untested modules are covered.
      thresholds: {
        statements: 18,
        lines: 18,
        functions: 45,
        branches: 75,
        "src/lib/storage/**": { statements: 80, lines: 80, functions: 80, branches: 80 },
        "src/lib/permissions.ts": { statements: 90, lines: 90, functions: 90, branches: 90 },
        "src/lib/expiryUtils.ts": { statements: 90, lines: 90, functions: 90, branches: 90 },
        "src/lib/scannerPin.js": { statements: 85, lines: 85, functions: 85, branches: 85 },
        "src/lib/apiHelpers.js": { statements: 75, lines: 75, functions: 75, branches: 75 },
        "src/lib/utils.js": { statements: 80, lines: 80, functions: 75, branches: 80 },
      },
    },
  },
});
