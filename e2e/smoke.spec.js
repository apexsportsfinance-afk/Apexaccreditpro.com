import { test, expect } from "@playwright/test";

// Smoke tests — the thinnest possible "is the app alive and are the money/
// identity paths reachable" coverage. Expand these into the critical-journey
// suite (login → dashboard, badge scan, checkout) as the next step.

test("login page renders and exposes the auth form", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveTitle(/.+/); // has a title at all
  // Email + password fields should be present on the login screen.
  await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
});

test("public verify route loads without crashing", async ({ page }) => {
  const res = await page.goto("/verify");
  expect(res?.status()).toBeLessThan(500);
  // The SPA shell should mount (no white-screen / uncaught error overlay).
  await expect(page.locator("body")).toBeVisible();
});
