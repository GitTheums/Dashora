import { expect, test } from "@playwright/test";
import { mockSession } from "./helpers/mock-api.js";

test("keyboard-only primary flow: open settings and switch theme", async ({ page }) => {
  await mockSession(page, { withLayout: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();

  await page.keyboard.press("Tab");
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.getAttribute("aria-label") ?? el?.textContent ?? "";
    });
    if (/settings/i.test(focused)) {
      break;
    }
    await page.keyboard.press("Tab");
  }

  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: /Appearance/i })).toBeVisible({
    timeout: 10_000,
  });

  const mode = page.getByLabel("Mode", { exact: true });
  await mode.focus();
  await mode.selectOption("dark");

  await expect.poll(async () => page.locator("html").getAttribute("data-theme")).toBe("dark");
});

test("keyboard-only page creation from edit mode", async ({ page }) => {
  await mockSession(page, { withLayout: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await page.getByRole("button", { name: "Edit dashboard" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Add page" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Create page" })).toBeVisible();

  await page.getByLabel("Name").fill("Lab");
  await page.getByRole("button", { name: "Create" }).focus();
  await page.keyboard.press("Enter");

  await expect(page.getByRole("heading", { level: 1, name: "Lab" })).toBeVisible({
    timeout: 10_000,
  });
});
