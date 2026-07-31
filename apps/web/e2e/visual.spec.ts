import { DEFAULT_THEME_PREFERENCES } from "@dashora/shared";
import { expect, test } from "@playwright/test";
import { mockSession } from "./helpers/mock-api.js";

test.describe("visual regression", () => {
  test("main dashboard light mode", async ({ page }) => {
    await mockSession(page, {
      withLayout: true,
      preferences: { ...DEFAULT_THEME_PREFERENCES, mode: "light" },
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await expect(page).toHaveScreenshot("dashboard-home-light.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.04,
      fullPage: false,
      clip: { x: 0, y: 0, width: 1280, height: 720 },
    });
  });

  test("main dashboard dark mode", async ({ page }) => {
    await mockSession(page, {
      withLayout: true,
      preferences: { ...DEFAULT_THEME_PREFERENCES, mode: "dark" },
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await expect(page).toHaveScreenshot("dashboard-home-dark.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.04,
      fullPage: false,
      clip: { x: 0, y: 0, width: 1280, height: 720 },
    });
  });

  test("mobile dashboard light mode", async ({ page }) => {
    await mockSession(page, {
      withLayout: true,
      preferences: { ...DEFAULT_THEME_PREFERENCES, mode: "light" },
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();

    await expect(page).toHaveScreenshot("dashboard-home-mobile-light.png", {
      animations: "disabled",
      maxDiffPixelRatio: 0.05,
      fullPage: false,
      clip: { x: 0, y: 0, width: 390, height: 700 },
    });
  });
});
