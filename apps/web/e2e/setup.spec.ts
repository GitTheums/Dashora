import { expect, test } from "@playwright/test";
import { mockSession } from "./helpers/mock-api.js";

test("first-run setup creates an admin account", async ({ page }) => {
  await mockSession(page, { authenticated: false, setupRequired: true, withLayout: true });
  await page.goto("/setup?token=test-setup-token");

  await expect(page.getByRole("heading", { name: "Create your admin account" })).toBeVisible();
  await page.getByLabel("Display name").fill("Admin");
  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-battery");
  await page.getByLabel("Confirm password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create admin" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page).toHaveURL(/\/(home)?$/);
});

test("setup without a token points operators at the server logs", async ({ page }) => {
  await mockSession(page, { authenticated: false, setupRequired: true, withLayout: false });
  await page.goto("/setup");
  await expect(page.getByRole("heading", { name: "Setup token required" })).toBeVisible();
  await expect(page.getByText(/server console/i)).toBeVisible();
});
