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
    },
  },
});
