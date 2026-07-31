import { DEFAULT_THEME_PREFERENCES, type ThemePreferences } from "@dashora/shared";
import { type Page, expect, test } from "@playwright/test";

const DASHBOARD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function mockAppearanceSession(page: Page) {
  const now = Date.now();
  let preferences: ThemePreferences = structuredClone(DEFAULT_THEME_PREFERENCES);
  let themeOverride: Record<string, unknown> | null = null;

  const pages = [
    { name: "Home", slug: "home", icon: "home" as const },
    { name: "Markets", slug: "markets", icon: "chart" as const },
  ].map((entry, index) => ({
    id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(index + 1).padStart(12, "0")}`,
    dashboardId: DASHBOARD_ID,
    name: entry.name,
    slug: entry.slug,
    icon: entry.icon,
    accent: null,
    sortOrder: index,
    createdAt: now,
    updatedAt: now,
  }));

  await page.route("**/api/v1/setup/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ setupRequired: false }),
    });
  });
  await page.route("**/api/v1/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "11111111-1111-4111-8111-111111111111",
          email: "thom@example.com",
          displayName: "Thom",
        },
      }),
    });
  });
  await page.route("**/api/v1/auth/csrf", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ csrfToken: "test-csrf" }),
    });
  });
  await page.route("**/api/v1/settings/theme", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ preferences }),
      });
      return;
    }
    if (route.request().method() === "PUT") {
      preferences = route.request().postDataJSON() as ThemePreferences;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ preferences }),
      });
      return;
    }
    await route.fallback();
  });
  await page.route("**/api/v1/settings/theme/reset", async (route) => {
    preferences = structuredClone(DEFAULT_THEME_PREFERENCES);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ preferences }),
    });
  });
  await page.route("**/api/v1/dashboard/theme", async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON() as {
        themeOverride: Record<string, unknown> | null;
      };
      themeOverride = body.themeOverride;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ themeOverride }),
      });
      return;
    }
    await route.fallback();
  });
  await page.route("**/api/v1/dashboard", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        dashboard: {
          id: DASHBOARD_ID,
          name: "Dashboard",
          slug: "default",
          themeOverride,
          pages,
          createdAt: now,
          updatedAt: now,
        },
      }),
    });
  });
  await page.route("**/api/v1/dashboard/pages/*/layout", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        pageId: pages[0]?.id,
        layout: { version: 1, widgets: [], layouts: { lg: [], md: [], sm: [] } },
        updatedAt: 0,
        isDefault: true,
      }),
    });
  });

  return {
    getPreferences: () => preferences,
    getOverride: () => themeOverride,
  };
}

test("opens Appearance from Settings and persists global then dashboard scope", async ({
  page,
}) => {
  const state = await mockAppearanceSession(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/home");

  await expect(page.getByRole("button", { name: "Settings" })).toBeVisible();
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings\/appearance/);
  await expect(page.getByRole("heading", { name: "Appearance" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Appearance" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await page.getByRole("radio", { name: "All dashboards" }).check();
  await page.getByRole("button", { name: "Aurora" }).click();
  await page.getByLabel("Density", { exact: true }).selectOption("compact");
  await page.getByLabel("Card radius", { exact: true }).selectOption("rounded");
  await expect(page.locator("html")).toHaveAttribute("data-preset", "aurora");
  await expect(page.locator("html")).toHaveAttribute("data-density", "compact");

  await page.getByRole("button", { name: "Save globally" }).click();
  await expect(page.getByText("Global appearance saved.")).toBeVisible();
  expect(state.getPreferences().preset).toBe("aurora");
  expect(state.getPreferences().density).toBe("compact");

  await page.getByRole("banner").getByRole("button", { name: "Back to dashboard" }).click();
  await expect(page).toHaveURL(/\/home/);
  await expect(page.locator("html")).toHaveAttribute("data-preset", "aurora");

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("radio", { name: "Current dashboard only" }).check();
  await page.getByRole("button", { name: "Graphite" }).click();
  await page.getByRole("button", { name: "Save for dashboard" }).click();
  await expect(page.getByText("Dashboard appearance saved.")).toBeVisible();
  expect(state.getOverride()).toMatchObject({ preset: "graphite" });
  expect(state.getPreferences().preset).toBe("aurora");

  await page.getByRole("button", { name: "Use global appearance" }).click();
  await expect(page.getByText(/using global appearance/i)).toBeVisible();
  expect(state.getOverride()).toBeNull();
});

test("Settings is reachable on a mobile viewport", async ({ page }) => {
  await mockAppearanceSession(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/home");

  const settings = page.getByRole("button", { name: "Settings" });
  await expect(settings).toBeVisible();
  await settings.click();
  await expect(page).toHaveURL(/\/settings\/appearance/);
  await expect(page.getByRole("heading", { name: "Appearance" })).toBeVisible();
});

test("Account settings shows identity and sign out", async ({ page }) => {
  await mockAppearanceSession(page);
  await page.goto("/home");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("link", { name: "Account" }).click();
  await expect(page).toHaveURL(/\/settings\/account/);
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
  await expect(page.getByText("Thom", { exact: true })).toBeVisible();
  await expect(page.getByText("thom@example.com", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
});

test("unauthenticated settings access redirects to login", async ({ page }) => {
  await page.route("**/api/v1/setup/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ setupRequired: false }),
    });
  });
  await page.route("**/api/v1/auth/me", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "unauthenticated", message: "Auth required" } }),
    });
  });

  await page.goto("/settings/appearance");
  await expect(page).toHaveURL(/\/login/);
});
