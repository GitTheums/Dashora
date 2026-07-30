import {
  githubIntegrationResponseSchema,
  githubIntegrationsResponseSchema,
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

describe("GitHub integration API", () => {
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
        email: "github@example.com",
        password: "correct-horse-battery-staple",
        displayName: "GitHub",
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
    authCookies = { ...authCookies, ...parseCookies(refreshedCsrf) };
    csrfToken = refreshedCsrf.json().csrfToken as string;
    expect(authCookies[CSRF_COOKIE_NAME]).toBeTruthy();
  }

  it("stores a token server-side without returning it", async () => {
    await startAuthenticated();

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/github",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(authCookies),
        "x-csrf-token": csrfToken,
      },
      payload: {
        name: "GitHub",
        token: "ghp_test_token_abcdef",
      },
    });
    expect(createResponse.statusCode).toBe(201);
    const created = githubIntegrationResponseSchema.parse(createResponse.json());
    expect(created.integration.hasToken).toBe(true);
    expect(created.integration.tokenHint).toBe("cdef");
    expect(JSON.stringify(createResponse.json())).not.toContain("ghp_test_token_abcdef");

    const listResponse = await app.inject({
      method: "GET",
      url: "/api/v1/integrations/github",
      headers: { cookie: cookieHeader(authCookies) },
    });
    expect(listResponse.statusCode).toBe(200);
    const listed = githubIntegrationsResponseSchema.parse(listResponse.json());
    expect(listed.integrations).toHaveLength(1);
    expect(JSON.stringify(listResponse.json())).not.toContain("ghp_test_token_abcdef");
  });
});
