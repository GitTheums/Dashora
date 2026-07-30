import { type Page, expect, test } from "@playwright/test";

const DASHBOARD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const HOME_PAGE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-000000000001";
const WEATHER_ID = "a1111111-1111-4111-8111-111111111101";

type LayoutDocument = {
  version: 1;
  widgets: Array<{
    id: string;
    title: string;
    description?: string;
    tone?: string;
    kind?: string;
    enabled?: boolean;
  }>;
  layouts: {
    lg: Array<{ i: string; x: number; y: number; w: number; h: number }>;
    md: Array<{ i: string; x: number; y: number; w: number; h: number }>;
    sm: Array<{ i: string; x: number; y: number; w: number; h: number }>;
  };
};

function defaultLayout(): LayoutDocument {
  const ids = {
    weather: WEATHER_ID,
    calendar: "a1111111-1111-4111-8111-111111111102",
    markets: "a1111111-1111-4111-8111-111111111103",
    services: "a1111111-1111-4111-8111-111111111104",
    feed: "a1111111-1111-4111-8111-111111111105",
    notes: "a1111111-1111-4111-8111-111111111106",
    bookmarks: "a1111111-1111-4111-8111-111111111107",
    status: "a1111111-1111-4111-8111-111111111108",
  };
  return {
    version: 1,
    widgets: [
      {
        kind: "placeholder",
        id: ids.weather,
        title: "Weather",
        description: "Placeholder conditions",
        tone: "accent",
        enabled: true,
      },
      {
        kind: "placeholder",
        id: ids.calendar,
        title: "Calendar",
        description: "Upcoming events placeholder",
        enabled: true,
      },
      {
        kind: "placeholder",
        id: ids.markets,
        title: "Markets",
        description: "Ticker placeholder",
        enabled: true,
      },
      {
        kind: "placeholder",
        id: ids.services,
        title: "Services",
        description: "Health checks placeholder",
        tone: "muted",
        enabled: true,
      },
      {
        kind: "placeholder",
        id: ids.feed,
        title: "Feed",
        description: "Headlines placeholder",
        enabled: true,
      },
      {
        kind: "placeholder",
        id: ids.notes,
        title: "Notes",
        description: "Scratch pad placeholder",
        tone: "muted",
        enabled: true,
      },
      {
        kind: "placeholder",
        id: ids.bookmarks,
        title: "Bookmarks",
        description: "Quick links placeholder",
        enabled: true,
      },
      {
        kind: "placeholder",
        id: ids.status,
        title: "Status",
        description: "System status placeholder",
        tone: "accent",
        enabled: true,
      },
    ],
    layouts: {
      lg: [
        { i: ids.weather, x: 0, y: 0, w: 4, h: 2 },
        { i: ids.calendar, x: 4, y: 0, w: 4, h: 2 },
        { i: ids.markets, x: 8, y: 0, w: 4, h: 2 },
        { i: ids.services, x: 0, y: 2, w: 6, h: 2 },
        { i: ids.feed, x: 6, y: 2, w: 6, h: 3 },
        { i: ids.notes, x: 0, y: 5, w: 4, h: 2 },
        { i: ids.bookmarks, x: 4, y: 5, w: 4, h: 2 },
        { i: ids.status, x: 8, y: 5, w: 4, h: 1 },
      ],
      md: [
        { i: ids.weather, x: 0, y: 0, w: 4, h: 2 },
        { i: ids.calendar, x: 4, y: 0, w: 4, h: 2 },
        { i: ids.markets, x: 0, y: 2, w: 4, h: 2 },
        { i: ids.services, x: 4, y: 2, w: 4, h: 2 },
        { i: ids.feed, x: 0, y: 4, w: 8, h: 3 },
        { i: ids.notes, x: 0, y: 7, w: 4, h: 2 },
        { i: ids.bookmarks, x: 4, y: 7, w: 4, h: 2 },
        { i: ids.status, x: 0, y: 9, w: 8, h: 1 },
      ],
      sm: [
        { i: ids.weather, x: 0, y: 0, w: 4, h: 2 },
        { i: ids.calendar, x: 0, y: 2, w: 4, h: 2 },
        { i: ids.markets, x: 0, y: 4, w: 4, h: 2 },
        { i: ids.services, x: 0, y: 6, w: 4, h: 2 },
        { i: ids.feed, x: 0, y: 8, w: 4, h: 3 },
        { i: ids.notes, x: 0, y: 11, w: 4, h: 2 },
        { i: ids.bookmarks, x: 0, y: 13, w: 4, h: 2 },
        { i: ids.status, x: 0, y: 15, w: 4, h: 1 },
      ],
    },
  };
}

async function mockAuthenticatedSession(page: Page) {
  const now = Date.now();
  const pages = [
    { name: "Home", slug: "home", icon: "home" },
    { name: "Markets", slug: "markets", icon: "chart" },
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

  const layouts = new Map<string, LayoutDocument>();

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
  await page.route("**/api/v1/dashboard", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        dashboard: {
          id: DASHBOARD_ID,
          name: "Dashboard",
          slug: "default",
          pages,
          createdAt: now,
          updatedAt: now,
        },
      }),
    });
  });
  await page.route("**/api/v1/dashboard/pages/*/layout", async (route) => {
    const url = new URL(route.request().url());
    const parts = url.pathname.split("/");
    const pageId = parts[parts.indexOf("pages") + 1] ?? HOME_PAGE_ID;
    if (route.request().method() === "GET") {
      const stored = layouts.get(pageId);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          pageId,
          layout: stored ?? defaultLayout(),
          updatedAt: stored ? Date.now() : 0,
          isDefault: !stored,
        }),
      });
      return;
    }
    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON() as { layout: LayoutDocument };
      layouts.set(pageId, body.layout);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          pageId,
          layout: body.layout,
          updatedAt: Date.now(),
          isDefault: false,
        }),
      });
      return;
    }
    await route.fallback();
  });
}

test("view mode hides edit controls; edit mode restores them and persists layout", async ({
  page,
}) => {
  await mockAuthenticatedSession(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
  const widget = page.locator(`[data-widget-id="${WEATHER_ID}"]`);
  await expect(widget).toBeVisible();

  await expect(page.getByRole("button", { name: "Add widget" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Weather actions/i })).toHaveCount(0);
  await expect(page.getByLabel(/Drag Weather/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Refresh Weather/i })).toBeVisible();
  await expect(page.locator(".react-resizable-handle-se:visible")).toHaveCount(0);

  await page.getByRole("button", { name: "Edit dashboard" }).click();
  await expect(page.getByRole("button", { name: "Add widget" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Weather actions/i })).toBeVisible();
  await expect(page.getByLabel(/Drag Weather/i)).toBeVisible();
  await expect(
    page.locator(
      `.dash-layout__item:has([data-widget-id="${WEATHER_ID}"]) .react-resizable-handle-se:visible`,
    ),
  ).toHaveCount(1);

  const original = await widget.evaluate((el) => {
    const item = el.closest(".dash-layout__item") as HTMLElement | null;
    if (!item) {
      return null;
    }
    const rect = item.getBoundingClientRect();
    return { top: rect.top, left: rect.left };
  });
  expect(original).not.toBeNull();
  if (!original) {
    return;
  }

  const handle = widget.locator(".layout-placeholder__drag-handle");
  const handleBox = await handle.boundingBox();
  expect(handleBox).not.toBeNull();
  if (!handleBox) {
    return;
  }

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    handleBox.x + handleBox.width / 2 + 160,
    handleBox.y + handleBox.height / 2 + 180,
    { steps: 16 },
  );
  await page.mouse.up();

  const afterDrag = await widget.evaluate((el) => {
    const item = el.closest(".dash-layout__item") as HTMLElement | null;
    if (!item) {
      return null;
    }
    const rect = item.getBoundingClientRect();
    return { top: rect.top, left: rect.left };
  });
  expect(afterDrag).not.toBeNull();
  if (!afterDrag) {
    return;
  }
  expect(Math.abs(afterDrag.left - original.left)).toBeGreaterThan(40);
  expect(Math.abs(afterDrag.top - original.top)).toBeGreaterThan(40);
  await expect(page.getByText(/Layout saved|Unsaved changes|Saving/i)).toBeVisible({
    timeout: 5_000,
  });
  await expect(page.getByText("Layout saved")).toBeVisible({ timeout: 5_000 });

  await page.getByRole("button", { name: "Finish editing dashboard" }).click();
  await expect(page.getByRole("button", { name: "Add widget" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Weather actions/i })).toHaveCount(0);
  await expect(page.getByLabel(/Drag Weather/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Refresh Weather/i })).toBeVisible();
  await expect(page.locator(".react-resizable-handle-se:visible")).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Home" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add widget" })).toHaveCount(0);

  const reloaded = page.locator(`[data-widget-id="${WEATHER_ID}"]`);
  await expect(reloaded).toBeVisible();
  const afterReload = await reloaded.evaluate((el) => {
    const item = el.closest(".dash-layout__item") as HTMLElement | null;
    if (!item) {
      return null;
    }
    const rect = item.getBoundingClientRect();
    return { top: rect.top, left: rect.left };
  });
  expect(afterReload).not.toBeNull();
  if (!afterReload || !original) {
    return;
  }
  expect(Math.abs(afterReload.left - original.left)).toBeGreaterThan(40);
  expect(Math.abs(afterReload.top - original.top)).toBeGreaterThan(40);
});
