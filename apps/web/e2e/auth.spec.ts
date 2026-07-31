import { expect, test } from "@playwright/test";
import { mockSession } from "./helpers/mock-api.js";

test("login and logout round-trip", async ({ page }) => {
  const session = await mockSession(page, {
    authenticated: false,
    setupRequired: false,
    withLayout: true,
  });

  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in to Dashora" })).toBeVisible();
  await page.getByLabel("Email").fill("thom@example.com");
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible({
    timeout: 10_000,
  });
  expect(session.isSignedIn()).toBe(true);

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("link", { name: "Account" }).click();
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();

  await expect(page.getByRole("heading", { name: "Sign in to Dashora" })).toBeVisible({
    timeout: 10_000,
  });
  expect(session.isSignedIn()).toBe(false);
});
