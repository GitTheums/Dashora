import {
  addWidgetToLayout,
  createDefaultPageLayout,
  createPageWidgetResponseSchema,
  dashboardResponseSchema,
  isDashoraUuid,
  pageLayoutResponseSchema,
  removeWidgetFromLayout,
  setupResponseSchema,
  updateWidgetInLayout,
} from "@dashora/shared";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from "../auth/cookies.js";
import { createSetupService } from "../auth/setup-service.js";
import { type TestDatabase, createTestDatabase } from "../db/test-utils.js";
import { createTestServerEnv } from "../test/env.js";

function parseCookies(response: LightMyRequestResponse): Record<string, string> {
  const raw = response.headers["set-cookie"];
  const lines = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const out: Record<string, string> = {};
  for (const line of lines) {
    const pair = line.split(";")[0];
    if (!pair) {
      continue;
    }
    const eq = pair.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    out[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return out;
}

function cookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

describe("typed widget CRUD via layout API", () => {
  let db: TestDatabase;
  let app: FastifyInstance;
  let authCookies: Record<string, string>;
  let csrfToken: string;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    if (db) {
      db.cleanup();
    }
  });

  async function startAuthenticated() {
    db = createTestDatabase();
    const env = createTestServerEnv({
      PUBLIC_BASE_URL: "http://localhost:5173",
      LOGIN_RATE_LIMIT_MAX: 50,
    });
    const setup = createSetupService({
      db: db.db,
      setupTokenTtlMs: env.SETUP_TOKEN_TTL_MS,
      nodeEnv: env.NODE_ENV,
    });
    app = await buildApp({
      version: "0.1.0-test",
      logger: false,
      database: db,
      setup,
      env,
    });

    const csrfResponse = await app.inject({ method: "GET", url: "/api/v1/auth/csrf" });
    const csrfCookies = parseCookies(csrfResponse);
    const setupToken = setup.getPlaintextForTests();
    if (!setupToken) {
      throw new Error("expected setup token");
    }

    const setupResponse = await app.inject({
      method: "POST",
      url: "/api/v1/setup/complete",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(csrfCookies),
        "x-csrf-token": csrfResponse.json().csrfToken as string,
      },
      payload: {
        token: setupToken,
        email: "widget-crud@example.com",
        password: "correct-horse-battery-staple",
        displayName: "Widget CRUD",
      },
    });
    expect(setupResponse.statusCode).toBe(200);
    setupResponseSchema.parse(setupResponse.json());
    authCookies = { ...csrfCookies, ...parseCookies(setupResponse) };
    expect(authCookies[SESSION_COOKIE_NAME]).toBeTruthy();

    const refreshedCsrf = await app.inject({
      method: "GET",
      url: "/api/v1/auth/csrf",
      headers: { cookie: cookieHeader(authCookies) },
    });
    csrfToken = refreshedCsrf.json().csrfToken as string;
    authCookies = { ...authCookies, ...parseCookies(refreshedCsrf) };
    expect(authCookies[CSRF_COOKIE_NAME]).toBe(csrfToken);
  }

  it("adds, updates, and removes a typed widget instance in a page layout", async () => {
    await startAuthenticated();

    const dashboard = dashboardResponseSchema.parse(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/dashboard",
          headers: { cookie: cookieHeader(authCookies) },
        })
      ).json(),
    );
    const home = dashboard.dashboard.pages.find((page) => page.slug === "home");
    expect(home).toBeDefined();
    if (!home) {
      return;
    }

    const layoutPath = `/api/v1/dashboard/pages/${home.id}/layout`;
    const current = pageLayoutResponseSchema.parse(
      (
        await app.inject({
          method: "GET",
          url: layoutPath,
          headers: { cookie: cookieHeader(authCookies) },
        })
      ).json(),
    );

    const widgetId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const withWidget = addWidgetToLayout(
      current.layout,
      {
        kind: "widget",
        id: widgetId,
        type: "clock",
        title: "Desk clock",
        enabled: true,
        config: { timezone: "UTC", format: "24h" },
        schemaVersion: 1,
      },
      { colSpan: 4, rowSpan: 2, minColSpan: 2, minRowSpan: 1 },
    );

    const created = await app.inject({
      method: "PUT",
      url: layoutPath,
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(authCookies),
        "x-csrf-token": csrfToken,
      },
      payload: { layout: withWidget },
    });
    expect(created.statusCode).toBe(200);
    const createdBody = pageLayoutResponseSchema.parse(created.json());
    const createdWidget = createdBody.layout.widgets.find((widget) => widget.id === widgetId);
    expect(createdWidget).toMatchObject({
      kind: "widget",
      type: "clock",
      title: "Desk clock",
    });

    const updatedLayout = updateWidgetInLayout(createdBody.layout, widgetId, (widget) => ({
      ...widget,
      title: "Travel clock",
      refreshIntervalSeconds: 30,
    }));
    const updated = await app.inject({
      method: "PUT",
      url: layoutPath,
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(authCookies),
        "x-csrf-token": csrfToken,
      },
      payload: { layout: updatedLayout },
    });
    expect(updated.statusCode).toBe(200);
    const updatedBody = pageLayoutResponseSchema.parse(updated.json());
    expect(updatedBody.layout.widgets.find((widget) => widget.id === widgetId)).toMatchObject({
      title: "Travel clock",
      refreshIntervalSeconds: 30,
    });

    const removedLayout = removeWidgetFromLayout(updatedBody.layout, widgetId);
    const removed = await app.inject({
      method: "PUT",
      url: layoutPath,
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(authCookies),
        "x-csrf-token": csrfToken,
      },
      payload: { layout: removedLayout },
    });
    expect(removed.statusCode).toBe(200);
    const removedBody = pageLayoutResponseSchema.parse(removed.json());
    expect(removedBody.layout.widgets.some((widget) => widget.id === widgetId)).toBe(false);
    expect(removedBody.layout.layouts.lg.some((item) => item.i === widgetId)).toBe(false);
  });

  it("creates weather and rss widgets with distinct server-minted UUIDs", async () => {
    await startAuthenticated();
    const dashboard = dashboardResponseSchema.parse(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/dashboard",
          headers: { cookie: cookieHeader(authCookies) },
        })
      ).json(),
    );
    const home = dashboard.dashboard.pages.find((page) => page.slug === "home");
    expect(home).toBeDefined();
    if (!home) {
      return;
    }

    const createPath = `/api/v1/dashboard/pages/${home.id}/widgets`;
    const weather = await app.inject({
      method: "POST",
      url: createPath,
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(authCookies),
        "x-csrf-token": csrfToken,
      },
      payload: {
        kind: "widget",
        type: "weather",
        title: "Weather",
        config: {},
        schemaVersion: 1,
        defaultLayout: { colSpan: 4, rowSpan: 2 },
      },
    });
    expect(weather.statusCode).toBe(201);
    const weatherBody = createPageWidgetResponseSchema.parse(weather.json());
    expect(weatherBody.widget.kind).toBe("widget");
    if (weatherBody.widget.kind !== "widget") {
      return;
    }
    expect(isDashoraUuid(weatherBody.widget.id)).toBe(true);
    expect(weatherBody.widget.id).not.toBe("weather");
    expect(weatherBody.widget.type).toBe("weather");
    expect(weatherBody.layout.layouts.lg.some((item) => item.i === weatherBody.widget.id)).toBe(
      true,
    );

    const rss = await app.inject({
      method: "POST",
      url: createPath,
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(authCookies),
        "x-csrf-token": csrfToken,
      },
      payload: {
        kind: "widget",
        type: "rss",
        title: "RSS",
        config: { feeds: [] },
        schemaVersion: 1,
        defaultLayout: { colSpan: 4, rowSpan: 3 },
      },
    });
    expect(rss.statusCode).toBe(201);
    const rssBody = createPageWidgetResponseSchema.parse(rss.json());
    expect(rssBody.widget.kind).toBe("widget");
    if (rssBody.widget.kind !== "widget") {
      return;
    }
    expect(isDashoraUuid(rssBody.widget.id)).toBe(true);
    expect(rssBody.widget.id).not.toBe(weatherBody.widget.id);
    expect(rssBody.widget.type).toBe("rss");

    const weatherAgain = await app.inject({
      method: "POST",
      url: createPath,
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(authCookies),
        "x-csrf-token": csrfToken,
      },
      payload: {
        kind: "widget",
        type: "weather",
        title: "Weather 2",
        config: {},
        schemaVersion: 1,
        defaultLayout: { colSpan: 4, rowSpan: 2 },
      },
    });
    expect(weatherAgain.statusCode).toBe(201);
    const weatherAgainBody = createPageWidgetResponseSchema.parse(weatherAgain.json());
    expect(weatherAgainBody.widget.id).not.toBe(weatherBody.widget.id);
    expect(weatherAgainBody.widget.id).not.toBe("weather");

    const persisted = pageLayoutResponseSchema.parse(
      (
        await app.inject({
          method: "GET",
          url: `/api/v1/dashboard/pages/${home.id}/layout`,
          headers: { cookie: cookieHeader(authCookies) },
        })
      ).json(),
    );
    const ids = persisted.layout.widgets
      .filter((widget) => widget.kind === "widget" && widget.type === "weather")
      .map((widget) => widget.id);
    expect(ids).toContain(weatherBody.widget.id);
    expect(ids).toContain(weatherAgainBody.widget.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("rejects create requests that try to supply a client widget id", async () => {
    await startAuthenticated();
    const dashboard = dashboardResponseSchema.parse(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/dashboard",
          headers: { cookie: cookieHeader(authCookies) },
        })
      ).json(),
    );
    const home = dashboard.dashboard.pages[0];
    expect(home).toBeDefined();
    if (!home) {
      return;
    }

    const rejected = await app.inject({
      method: "POST",
      url: `/api/v1/dashboard/pages/${home.id}/widgets`,
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(authCookies),
        "x-csrf-token": csrfToken,
      },
      payload: {
        kind: "widget",
        id: "weather",
        type: "weather",
        defaultLayout: { colSpan: 4, rowSpan: 2 },
      },
    });
    expect(rejected.statusCode).toBe(400);
  });

  it("rejects typed widgets with invalid type identifiers", async () => {
    await startAuthenticated();
    const dashboard = dashboardResponseSchema.parse(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/dashboard",
          headers: { cookie: cookieHeader(authCookies) },
        })
      ).json(),
    );
    const home = dashboard.dashboard.pages[0];
    expect(home).toBeDefined();
    if (!home) {
      return;
    }

    const layout = createDefaultPageLayout();
    const rejected = await app.inject({
      method: "PUT",
      url: `/api/v1/dashboard/pages/${home.id}/layout`,
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(authCookies),
        "x-csrf-token": csrfToken,
      },
      payload: {
        layout: {
          ...layout,
          widgets: [
            {
              kind: "widget",
              id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
              type: "Bad Type",
              title: "Broken",
              enabled: true,
              config: {},
              schemaVersion: 1,
            },
          ],
          layouts: { lg: [], md: [], sm: [] },
        },
      },
    });
    expect(rejected.statusCode).toBe(400);
  });
});
