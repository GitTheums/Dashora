import { DEFAULT_THEME_PREFERENCES, type ThemePreferences } from "@dashora/shared";
import type { Page } from "@playwright/test";

export const DASHBOARD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const HOME_PAGE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-000000000001";
export const WEATHER_ID = "a1111111-1111-4111-8111-111111111101";

export type LayoutDocument = {
  version: 1;
  widgets: Array<Record<string, unknown>>;
  layouts: {
    lg: Array<{ i: string; x: number; y: number; w: number; h: number }>;
    md: Array<{ i: string; x: number; y: number; w: number; h: number }>;
    sm: Array<{ i: string; x: number; y: number; w: number; h: number }>;
  };
};

export type PageRecord = {
  id: string;
  dashboardId: string;
  name: string;
  slug: string;
  icon: string;
  accent: string | null;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

export function defaultLayout(): LayoutDocument {
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

export type MockSessionOptions = {
  withLayout?: boolean;
  pages?: PageRecord[];
  authenticated?: boolean;
  setupRequired?: boolean;
  preferences?: ThemePreferences;
};

export async function mockSession(page: Page, options: MockSessionOptions = {}) {
  const now = Date.now();
  const authenticated = options.authenticated ?? true;
  const setupRequired = options.setupRequired ?? false;
  let preferences = structuredClone(options.preferences ?? DEFAULT_THEME_PREFERENCES);
  let signedIn = authenticated;
  let needsSetup = setupRequired;

  const pages: PageRecord[] =
    options.pages ??
    [
      { name: "Home", slug: "home", icon: "home" },
      { name: "Markets", slug: "markets", icon: "chart" },
      { name: "Gaming", slug: "gaming", icon: "gamepad" },
      { name: "Homelab", slug: "homelab", icon: "server" },
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
  let lastExported: unknown = null;

  await page.route("**/api/v1/setup/status", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ setupRequired: needsSetup }),
    });
  });

  await page.route("**/api/v1/auth/me", async (route) => {
    if (!signedIn) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "unauthenticated", message: "Authentication required" },
        }),
      });
      return;
    }
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

  await page.route("**/api/v1/auth/login", async (route) => {
    signedIn = true;
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

  await page.route("**/api/v1/auth/logout", async (route) => {
    signedIn = false;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await page.route("**/api/v1/setup/complete", async (route) => {
    signedIn = true;
    needsSetup = false;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "11111111-1111-4111-8111-111111111111",
          email: "admin@example.com",
          displayName: "Admin",
        },
      }),
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

  await page.route("**/api/v1/dashboard", async (route) => {
    if (!signedIn) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "unauthenticated", message: "Authentication required" },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        dashboard: {
          id: DASHBOARD_ID,
          name: "Dashboard",
          slug: "default",
          themeOverride: null,
          pages,
          createdAt: now,
          updatedAt: now,
        },
      }),
    });
  });

  await page.route("**/api/v1/dashboard/pages", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    const body = route.request().postDataJSON() as {
      name: string;
      slug: string;
      icon?: string;
      accent?: string | null;
    };
    const created: PageRecord = {
      id: `bbbbbbbb-bbbb-4bbb-8bbb-${String(pages.length + 1).padStart(12, "0")}`,
      dashboardId: DASHBOARD_ID,
      name: body.name,
      slug: body.slug,
      icon: body.icon ?? "grid",
      accent: body.accent ?? null,
      sortOrder: pages.length,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    pages.push(created);
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ page: created }),
    });
  });

  if (options.withLayout !== false) {
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

  await page.route("**/api/v1/backup/export", async (route) => {
    lastExported = {
      format: "dashora-config",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      generator: { app: "dashora", serverVersion: "0.1.0-test" },
      data: {
        themePreferences: preferences,
        integrations: [],
        dashboards: [
          {
            id: DASHBOARD_ID,
            name: "Dashboard",
            slug: "default",
            themeOverride: null,
            createdAt: 0,
            updatedAt: 0,
            pages: pages.map((entry) => ({
              id: entry.id,
              title: entry.name,
              slug: entry.slug,
              icon: entry.icon,
              accent: entry.accent,
              sortOrder: entry.sortOrder,
              createdAt: entry.createdAt,
              updatedAt: entry.updatedAt,
              layout: layouts.get(entry.id) ?? defaultLayout(),
              todos: [],
            })),
          },
        ],
      },
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(lastExported),
    });
  });

  return {
    pages,
    layouts,
    getPreferences: () => preferences,
    getLastExported: () => lastExported,
    isSignedIn: () => signedIn,
  };
}
