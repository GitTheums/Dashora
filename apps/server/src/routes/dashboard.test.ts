import {
  DEFAULT_DASHBOARD_PAGES,
  dashboardResponseSchema,
  deletePageResponseSchema,
  pageResponseSchema,
  setupResponseSchema,
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

describe("dashboard and page APIs", () => {
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
        email: "admin@example.com",
        displayName: "Admin",
        password: "correct-horse-battery",
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

  async function mutating(
    method: "POST" | "PATCH" | "PUT" | "DELETE",
    url: string,
    payload: Record<string, unknown> = {},
  ): Promise<LightMyRequestResponse> {
    return app.inject({
      method,
      url,
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(authCookies),
        "x-csrf-token": csrfToken,
      },
      payload,
    });
  }

  it("creates default dashboard pages after first setup", async () => {
    await startAuthenticated();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/dashboard",
      headers: { cookie: cookieHeader(authCookies) },
    });
    expect(response.statusCode).toBe(200);
    const body = dashboardResponseSchema.parse(response.json());
    expect(body.dashboard.slug).toBe("default");
    expect(body.dashboard.themeOverride).toBeNull();
    expect(body.dashboard.pages.map((page) => page.slug)).toEqual(
      DEFAULT_DASHBOARD_PAGES.map((page) => page.slug),
    );
    expect(body.dashboard.pages.map((page) => page.name)).toEqual(
      DEFAULT_DASHBOARD_PAGES.map((page) => page.name),
    );
    expect(body.dashboard.pages.map((page) => page.sortOrder)).toEqual([0, 1, 2, 3]);
  });

  it("stores and clears per-dashboard theme overrides", async () => {
    await startAuthenticated();

    const setOverride = await mutating("PATCH", "/api/v1/dashboard/theme", {
      themeOverride: { preset: "porcelain", density: "dense" },
    });
    expect(setOverride.statusCode).toBe(200);
    expect(setOverride.json()).toMatchObject({
      themeOverride: { preset: "porcelain", density: "dense" },
    });

    const reload = dashboardResponseSchema.parse(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/dashboard",
          headers: { cookie: cookieHeader(authCookies) },
        })
      ).json(),
    );
    expect(reload.dashboard.themeOverride).toEqual({
      preset: "porcelain",
      density: "dense",
    });

    const clear = await mutating("PATCH", "/api/v1/dashboard/theme", {
      themeOverride: null,
    });
    expect(clear.statusCode).toBe(200);
    expect(clear.json()).toMatchObject({ themeOverride: null });
  });

  it("rejects duplicate slugs within a dashboard", async () => {
    await startAuthenticated();
    const create = await mutating("POST", "/api/v1/dashboard/pages", {
      name: "Also Home",
      slug: "home",
      icon: "star",
    });
    expect(create.statusCode).toBe(409);
    expect(create.json()).toMatchObject({ error: { code: "slug_conflict" } });
  });

  it("reorders pages and persists the new sort order", async () => {
    await startAuthenticated();
    const initial = dashboardResponseSchema.parse(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/dashboard",
          headers: { cookie: cookieHeader(authCookies) },
        })
      ).json(),
    );
    const reversed = [...initial.dashboard.pages].reverse().map((page) => page.id);

    const reorder = await mutating("PUT", "/api/v1/dashboard/pages/order", {
      orderedIds: reversed,
    });
    expect(reorder.statusCode).toBe(200);
    const reordered = dashboardResponseSchema.parse(reorder.json());
    expect(reordered.dashboard.pages.map((page) => page.id)).toEqual(reversed);
    expect(reordered.dashboard.pages.map((page) => page.sortOrder)).toEqual([0, 1, 2, 3]);

    const reload = dashboardResponseSchema.parse(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/dashboard",
          headers: { cookie: cookieHeader(authCookies) },
        })
      ).json(),
    );
    expect(reload.dashboard.pages.map((page) => page.id)).toEqual(reversed);
  });

  it("duplicates a page with a unique slug and deletes pages with confirmation semantics", async () => {
    await startAuthenticated();
    const initial = dashboardResponseSchema.parse(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/dashboard",
          headers: { cookie: cookieHeader(authCookies) },
        })
      ).json(),
    );
    const home = initial.dashboard.pages.find((page) => page.slug === "home");
    expect(home).toBeDefined();
    if (!home) {
      return;
    }

    const duplicate = await mutating("POST", `/api/v1/dashboard/pages/${home.id}/duplicate`);
    expect(duplicate.statusCode).toBe(201);
    const duplicated = pageResponseSchema.parse(duplicate.json());
    expect(duplicated.page.slug).toBe("home-copy");
    expect(duplicated.page.name).toBe("Home copy");
    expect(duplicated.page.icon).toBe(home.icon);

    const rename = await mutating("PATCH", `/api/v1/dashboard/pages/${duplicated.page.id}`, {
      name: "Home twin",
      slug: "home-twin",
      accent: "#22C55E",
    });
    expect(rename.statusCode).toBe(200);
    expect(pageResponseSchema.parse(rename.json()).page).toMatchObject({
      name: "Home twin",
      slug: "home-twin",
      accent: "#22C55E",
    });

    const deleted = await mutating("DELETE", `/api/v1/dashboard/pages/${duplicated.page.id}`);
    expect(deleted.statusCode).toBe(200);
    expect(deletePageResponseSchema.parse(deleted.json())).toEqual({
      ok: true,
      deletedId: duplicated.page.id,
    });

    const afterDelete = dashboardResponseSchema.parse(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/dashboard",
          headers: { cookie: cookieHeader(authCookies) },
        })
      ).json(),
    );
    expect(afterDelete.dashboard.pages).toHaveLength(4);
    expect(afterDelete.dashboard.pages.some((page) => page.id === duplicated.page.id)).toBe(false);
  });

  it("refuses to delete the last remaining page", async () => {
    await startAuthenticated();
    const initial = dashboardResponseSchema.parse(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/dashboard",
          headers: { cookie: cookieHeader(authCookies) },
        })
      ).json(),
    );

    for (const page of initial.dashboard.pages.slice(1)) {
      const response = await mutating("DELETE", `/api/v1/dashboard/pages/${page.id}`);
      expect(response.statusCode).toBe(200);
    }

    const last = initial.dashboard.pages[0];
    expect(last).toBeDefined();
    if (!last) {
      return;
    }
    const blocked = await mutating("DELETE", `/api/v1/dashboard/pages/${last.id}`);
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json()).toMatchObject({ error: { code: "last_page" } });
  });

  it("requires authentication for dashboard reads", async () => {
    await startAuthenticated();
    const response = await app.inject({ method: "GET", url: "/api/v1/dashboard" });
    expect(response.statusCode).toBe(401);
  });

  it("returns a default layout, persists edits, and resets", async () => {
    await startAuthenticated();
    const { createDefaultPageLayout, pageLayoutResponseSchema } = await import("@dashora/shared");
    const initial = dashboardResponseSchema.parse(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/dashboard",
          headers: { cookie: cookieHeader(authCookies) },
        })
      ).json(),
    );
    const home = initial.dashboard.pages.find((page) => page.slug === "home");
    expect(home).toBeDefined();
    if (!home) {
      return;
    }

    const defaultResponse = await app.inject({
      method: "GET",
      url: `/api/v1/dashboard/pages/${home.id}/layout`,
      headers: { cookie: cookieHeader(authCookies) },
    });
    expect(defaultResponse.statusCode).toBe(200);
    const defaultBody = pageLayoutResponseSchema.parse(defaultResponse.json());
    expect(defaultBody.isDefault).toBe(true);
    expect(defaultBody.layout.widgets).toHaveLength(createDefaultPageLayout().widgets.length);

    const edited = structuredClone(defaultBody.layout);
    const statusId = edited.widgets.find((widget) => widget.title === "Status")?.id;
    expect(statusId).toBeDefined();
    const status = edited.layouts.lg.find((item) => item.i === statusId);
    expect(status).toBeDefined();
    if (!status || !statusId) {
      return;
    }
    status.y = status.y + 1;

    const save = await mutating("PUT", `/api/v1/dashboard/pages/${home.id}/layout`, {
      layout: edited,
    });
    expect(save.statusCode).toBe(200);
    const saved = pageLayoutResponseSchema.parse(save.json());
    expect(saved.isDefault).toBe(false);
    expect(saved.layout.layouts.lg.find((item) => item.i === statusId)?.y).toBe(status.y);

    const reload = pageLayoutResponseSchema.parse(
      (
        await app.inject({
          method: "GET",
          url: `/api/v1/dashboard/pages/${home.id}/layout`,
          headers: { cookie: cookieHeader(authCookies) },
        })
      ).json(),
    );
    expect(reload.isDefault).toBe(false);
    expect(reload.layout.layouts.lg.find((item) => item.i === statusId)?.y).toBe(status.y);

    const reset = await mutating("POST", `/api/v1/dashboard/pages/${home.id}/layout/reset`);
    expect(reset.statusCode).toBe(200);
    const resetBody = pageLayoutResponseSchema.parse(reset.json());
    expect(resetBody.layout.layouts.lg.find((item) => item.i === statusId)?.y).toBe(
      createDefaultPageLayout().layouts.lg.find((item) => item.i === statusId)?.y,
    );
  });

  it("rejects invalid layout payloads", async () => {
    await startAuthenticated();
    const initial = dashboardResponseSchema.parse(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/dashboard",
          headers: { cookie: cookieHeader(authCookies) },
        })
      ).json(),
    );
    const home = initial.dashboard.pages[0];
    expect(home).toBeDefined();
    if (!home) {
      return;
    }

    const rejected = await mutating("PUT", `/api/v1/dashboard/pages/${home.id}/layout`, {
      layout: {
        version: 1,
        widgets: [
          {
            kind: "placeholder",
            id: "orphan",
            title: "Orphan",
            tone: "default",
            enabled: true,
          },
        ],
        layouts: { lg: [], md: [], sm: [] },
      },
    });
    expect(rejected.statusCode).toBe(400);
    expect(rejected.json()).toMatchObject({ error: { code: "validation_error" } });
  });
});
