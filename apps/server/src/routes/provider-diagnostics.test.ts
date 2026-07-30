import { providerDiagnosticsResponseSchema, setupResponseSchema } from "@dashora/shared";
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

describe("GET /api/v1/admin/providers/diagnostics", () => {
  let db: TestDatabase;
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    if (db) {
      db.cleanup();
    }
  });

  async function startAuthenticatedApp() {
    db = createTestDatabase();
    const env = createTestServerEnv({ PUBLIC_BASE_URL: "http://localhost:5173" });
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

    const setupToken = setup.getPlaintextForTests();
    if (!setupToken) {
      throw new Error("expected setup token plaintext from ensureIssued");
    }

    const csrfResponse = await app.inject({ method: "GET", url: "/api/v1/auth/csrf" });
    const csrfCookies = parseCookies(csrfResponse);
    const csrfToken = (csrfResponse.json() as { csrfToken: string }).csrfToken;

    const complete = await app.inject({
      method: "POST",
      url: "/api/v1/setup/complete",
      headers: {
        cookie: cookieHeader(csrfCookies),
        "x-csrf-token": csrfToken,
        "content-type": "application/json",
      },
      payload: {
        token: setupToken,
        email: "admin@example.test",
        displayName: "Admin",
        password: "correct-horse-battery-staple",
      },
    });
    expect(complete.statusCode).toBe(200);
    setupResponseSchema.parse(complete.json());
    const sessionCookies = { ...csrfCookies, ...parseCookies(complete) };
    expect(sessionCookies[SESSION_COOKIE_NAME]).toBeTruthy();
    expect(sessionCookies[CSRF_COOKIE_NAME]).toBeTruthy();
    return sessionCookies;
  }

  it("requires authentication", async () => {
    db = createTestDatabase();
    app = await buildApp({
      version: "0.1.0-test",
      logger: false,
      database: db,
      env: createTestServerEnv(),
    });

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/providers/diagnostics",
    });
    expect(response.statusCode).toBe(401);
  });

  it("returns diagnostics without secrets for authenticated operators", async () => {
    const cookies = await startAuthenticatedApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/providers/diagnostics",
      headers: {
        cookie: cookieHeader(cookies),
      },
    });

    expect(response.statusCode).toBe(200);
    const body = providerDiagnosticsResponseSchema.parse(response.json());
    expect(body.platform.userAgent).toContain("Dashora");
    expect(body.cache.hits).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(body.providers)).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/authorization|bearer\s+\w+/i);
  });
});
