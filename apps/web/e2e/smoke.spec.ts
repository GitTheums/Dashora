import { expect, test } from "@playwright/test";

test("shows development environment message", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Dashora development environment is running" }),
  ).toBeVisible();
});
