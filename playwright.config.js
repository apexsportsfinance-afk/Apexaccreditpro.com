import { defineConfig, devices } from "@playwright/test";

// End-to-end config. Specs live in ./e2e (kept out of src so Vitest ignores
// them). To run locally:
//   npm i -D @playwright/test && npx playwright install chromium
//   npm run dev          # in one terminal (app on :5180)
//   npm run test:e2e
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:5180",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
