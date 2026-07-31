import { expect, test } from "@playwright/test";
import { mockSession } from "./helpers/mock-api.js";

test("switches theme from Appearance settings", async ({ page }) => {
  await mockSession(page, { withLayout: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: /Appearance/i })).toBeVisible();

  await page.getByLabel("Mode", { exact: true }).selectOption("dark");
  await page.getByRole("button", { name: "Save globally" }).click();
  await expect(page.getByText(/Global appearance saved/i)).toBeVisible();

  await page.getByRole("banner").getByRole("button", { name: "Back to dashboard" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("mobile dashboard navigation remains usable", async ({ page }) => {
  await mockSession(page, { withLayout: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
  await page.getByRole("button", { name: /Open page menu|Close page menu/i }).click();
  await expect(page.getByRole("navigation", { name: "Dashboard pages" })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Dashboard pages" })
    .getByRole("button", { name: "Markets", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Markets" })).toBeVisible();
});
