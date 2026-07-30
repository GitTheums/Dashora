import { setupResponseSchema } from "@dashora/shared";
import { widgetDataResponseSchema } from "@dashora/widget-sdk";
import {
  todoItemResponseSchema,
  todoItemsResponseSchema,
} from "@dashora/widget-sdk/widgets/todo/server";
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

describe("widget and todo APIs", () => {
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
        email: "widgets@example.com",
        password: "correct-horse-battery-staple",
        displayName: "Widgets",
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

  it("returns search widget data from config", async () => {
    await startAuthenticated();
    const config = encodeURIComponent(JSON.stringify({}));
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/widgets/search/instances/a1111111-1111-4111-8111-111111111201/data?config=${config}`,
      headers: { cookie: cookieHeader(authCookies) },
    });
    expect(response.statusCode).toBe(200);
    const body = widgetDataResponseSchema.parse(JSON.parse(response.body));
    expect(body.state).toBe("success");
    expect(body.widgetId).toBe("search");
  });

  it("returns clock widget data", async () => {
    await startAuthenticated();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/widgets/clock/instances/a1111111-1111-4111-8111-111111111202/data",
      headers: { cookie: cookieHeader(authCookies) },
    });
    expect(response.statusCode).toBe(200);
    const body = widgetDataResponseSchema.parse(JSON.parse(response.body));
    expect(body.state).toBe("success");
    expect(body.widgetId).toBe("clock");
  });

  it("supports todo CRUD, reorder, complete, and reopen", async () => {
    await startAuthenticated();
    const instanceId = "a1111111-1111-4111-8111-111111111203";

    const empty = await app.inject({
      method: "GET",
      url: `/api/v1/widgets/todo/instances/${instanceId}/items`,
      headers: { cookie: cookieHeader(authCookies) },
    });
    expect(empty.statusCode).toBe(200);
    expect(todoItemsResponseSchema.parse(JSON.parse(empty.body)).items).toEqual([]);

    const created = await app.inject({
      method: "POST",
      url: `/api/v1/widgets/todo/instances/${instanceId}/items`,
      headers: {
        cookie: cookieHeader(authCookies),
        "x-csrf-token": csrfToken,
      },
      payload: { title: "First task", dueAt: "2026-08-01T12:00:00.000Z" },
    });
    expect(created.statusCode).toBe(201);
    const first = todoItemResponseSchema.parse(JSON.parse(created.body)).item;
    expect(first.title).toBe("First task");
    expect(first.completed).toBe(false);

    const secondCreate = await app.inject({
      method: "POST",
      url: `/api/v1/widgets/todo/instances/${instanceId}/items`,
      headers: {
        cookie: cookieHeader(authCookies),
        "x-csrf-token": csrfToken,
      },
      payload: { title: "Second task" },
    });
    const second = todoItemResponseSchema.parse(JSON.parse(secondCreate.body)).item;

    const reordered = await app.inject({
      method: "PUT",
      url: `/api/v1/widgets/todo/instances/${instanceId}/items/order`,
      headers: {
        cookie: cookieHeader(authCookies),
        "x-csrf-token": csrfToken,
      },
      payload: { orderedIds: [second.id, first.id] },
    });
    expect(reordered.statusCode).toBe(200);
    const ordered = todoItemsResponseSchema.parse(JSON.parse(reordered.body)).items;
    expect(ordered.map((item) => item.id)).toEqual([second.id, first.id]);

    const completed = await app.inject({
      method: "PATCH",
      url: `/api/v1/widgets/todo/instances/${instanceId}/items/${first.id}`,
      headers: {
        cookie: cookieHeader(authCookies),
        "x-csrf-token": csrfToken,
      },
      payload: { completed: true },
    });
    expect(todoItemResponseSchema.parse(JSON.parse(completed.body)).item.completed).toBe(true);

    const reopened = await app.inject({
      method: "PATCH",
      url: `/api/v1/widgets/todo/instances/${instanceId}/items/${first.id}`,
      headers: {
        cookie: cookieHeader(authCookies),
        "x-csrf-token": csrfToken,
      },
      payload: { completed: false },
    });
    expect(todoItemResponseSchema.parse(JSON.parse(reopened.body)).item.completed).toBe(false);

    const deleted = await app.inject({
      method: "DELETE",
      url: `/api/v1/widgets/todo/instances/${instanceId}/items/${second.id}`,
      headers: {
        cookie: cookieHeader(authCookies),
        "x-csrf-token": csrfToken,
      },
    });
    expect(deleted.statusCode).toBe(204);

    const remaining = await app.inject({
      method: "GET",
      url: `/api/v1/widgets/todo/instances/${instanceId}/items`,
      headers: { cookie: cookieHeader(authCookies) },
    });
    expect(todoItemsResponseSchema.parse(JSON.parse(remaining.body)).items).toHaveLength(1);
  });
});
