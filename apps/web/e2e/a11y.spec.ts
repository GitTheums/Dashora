import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { mockSession } from "./helpers/mock-api.js";

test.describe("accessibility", () => {
  test("dashboard home has no serious axe violations", async ({ page }) => {
    await mockSession(page, { withLayout: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .disableRules(["color-contrast"])
      .analyze();

    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });

  test("login screen has no serious axe violations", async ({ page }) => {
    await mockSession(page, { authenticated: false, setupRequired: false, withLayout: false });
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in to Dashora" })).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .disableRules(["color-contrast"])
      .analyze();

    const serious = results.violations.filter(
      (violation) => violation.impact === "serious" || violation.impact === "critical",
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
});
