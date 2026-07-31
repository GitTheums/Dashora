import {
  DEFAULT_THEME_PREFERENCES,
  resetThemePreferencesResponseSchema,
  setupResponseSchema,
  themePreferencesResponseSchema,
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

describe("theme settings API", () => {
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

  it("returns defaults, persists updates, and resets", async () => {
    await startAuthenticated();

    const initial = await app.inject({
      method: "GET",
      url: "/api/v1/settings/theme",
      headers: { cookie: cookieHeader(authCookies) },
    });
    expect(initial.statusCode).toBe(200);
    expect(themePreferencesResponseSchema.parse(initial.json()).preferences).toEqual(
      DEFAULT_THEME_PREFERENCES,
    );

    const updated = await app.inject({
      method: "PUT",
      url: "/api/v1/settings/theme",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(authCookies),
        "x-csrf-token": csrfToken,
      },
      payload: {
        ...DEFAULT_THEME_PREFERENCES,
        mode: "dark",
        preset: "aurora",
        density: "compact",
        ambientBackground: false,
      },
    });
    expect(updated.statusCode).toBe(200);
    const saved = themePreferencesResponseSchema.parse(updated.json()).preferences;
    expect(saved.mode).toBe("dark");
    expect(saved.preset).toBe("aurora");
    expect(saved.density).toBe("compact");
    expect(saved.ambientBackground).toBe(false);

    const reload = themePreferencesResponseSchema.parse(
      (
        await app.inject({
          method: "GET",
          url: "/api/v1/settings/theme",
          headers: { cookie: cookieHeader(authCookies) },
        })
      ).json(),
    );
    expect(reload.preferences.preset).toBe("aurora");

    const reset = await app.inject({
      method: "POST",
      url: "/api/v1/settings/theme/reset",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(authCookies),
        "x-csrf-token": csrfToken,
      },
      payload: {},
    });
    expect(reset.statusCode).toBe(200);
    expect(resetThemePreferencesResponseSchema.parse(reset.json()).preferences).toEqual(
      DEFAULT_THEME_PREFERENCES,
    );

    const events = await db.repos.auditEvents.listRecent();
    expect(events.find((event) => event.event === "settings.theme.updated")).toMatchObject({
      success: true,
      actorEmail: "admin@example.com",
    });
    expect(events.find((event) => event.event === "settings.theme.reset")).toMatchObject({
      success: true,
      actorEmail: "admin@example.com",
    });
  });

  it("rejects invalid preference payloads", async () => {
    await startAuthenticated();
    const response = await app.inject({
      method: "PUT",
      url: "/api/v1/settings/theme",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(authCookies),
        "x-csrf-token": csrfToken,
      },
      payload: { mode: "neon" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "validation_error" } });
  });
});
