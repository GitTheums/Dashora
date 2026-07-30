import {
  authMeResponseSchema,
  setupResponseSchema,
  setupStatusResponseSchema,
} from "@dashora/shared";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { CSRF_COOKIE_NAME, SESSION_COOKIE_NAME } from "../auth/cookies.js";
import { createSetupService } from "../auth/setup-service.js";
import { hashToken } from "../auth/tokens.js";
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

function requireSetupToken(token: string | null): string {
  if (!token) {
    throw new Error("expected setup token plaintext from ensureIssued");
  }
  return token;
}

describe("auth and first-run setup", () => {
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

  async function startApp(overrides: Parameters<typeof createTestServerEnv>[0] = {}) {
    db = createTestDatabase();
    const env = createTestServerEnv({
      PUBLIC_BASE_URL: "http://localhost:5173",
      SESSION_TTL_MS: 2_000,
      SESSION_RENEWAL_THRESHOLD_MS: 1_500,
      LOGIN_RATE_LIMIT_MAX: 20,
      ...overrides,
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
    return setup;
  }

  async function issueCsrf(): Promise<{ token: string; cookies: Record<string, string> }> {
    const response = await app.inject({ method: "GET", url: "/api/v1/auth/csrf" });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { csrfToken: string };
    const cookies = parseCookies(response);
    expect(cookies[CSRF_COOKIE_NAME]).toBe(body.csrfToken);
    return { token: body.csrfToken, cookies };
  }

  async function completeSetup(
    setupToken: string,
    overrides: Partial<{
      email: string;
      displayName: string;
      password: string;
      token: string | undefined;
    }> = {},
  ) {
    const { token: csrfToken, cookies } = await issueCsrf();
    const payload: {
      token?: string;
      email: string;
      displayName: string;
      password: string;
    } = {
      email: overrides.email ?? "admin@example.com",
      displayName: overrides.displayName ?? "Admin",
      password: overrides.password ?? "correct-horse-battery",
    };
    if (!("token" in overrides)) {
      payload.token = setupToken;
    } else if (overrides.token !== undefined) {
      payload.token = overrides.token;
    }
    return app.inject({
      method: "POST",
      url: "/api/v1/setup/complete",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(cookies),
        "x-csrf-token": csrfToken,
      },
      payload,
    });
  }

  it("valid token creates the first admin", async () => {
    const setup = await startApp();
    const status = await app.inject({ method: "GET", url: "/api/v1/setup/status" });
    expect(status.statusCode).toBe(200);
    expect(setupStatusResponseSchema.parse(status.json()).setupRequired).toBe(true);
    expect(status.json()).not.toHaveProperty("token");

    const setupToken = setup.getPlaintextForTests();
    expect(setupToken).toBeTruthy();

    const response = await completeSetup(requireSetupToken(setupToken));
    expect(response.statusCode).toBe(200);
    const body = setupResponseSchema.parse(response.json());
    expect(body.user.email).toBe("admin@example.com");
    expect(parseCookies(response)[SESSION_COOKIE_NAME]).toBeTruthy();

    const statusAfter = await app.inject({ method: "GET", url: "/api/v1/setup/status" });
    expect(setupStatusResponseSchema.parse(statusAfter.json()).setupRequired).toBe(false);
  });

  it("rejects missing token", async () => {
    const setup = await startApp();
    expect(setup.getPlaintextForTests()).toBeTruthy();
    const response = await completeSetup("ignored", { token: undefined });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "missing_token" } });
  });

  it("rejects incorrect token without consuming it", async () => {
    const setup = await startApp();
    const realToken = setup.getPlaintextForTests();
    expect(realToken).toBeTruthy();

    const failed = await completeSetup("not-the-real-token-value-at-all");
    expect(failed.statusCode).toBe(403);
    expect(failed.json()).toMatchObject({ error: { code: "invalid_token" } });

    const retry = await completeSetup(requireSetupToken(realToken));
    expect(retry.statusCode).toBe(200);
  });

  it("rejects expired token", async () => {
    const setup = await startApp({ SETUP_TOKEN_TTL_MS: 50 });
    const setupToken = setup.getPlaintextForTests();
    expect(setupToken).toBeTruthy();
    await setup.expireActiveTokenForTests();

    const response = await completeSetup(requireSetupToken(setupToken));
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: "expired_token" } });
  });

  it("token survives a server restart", async () => {
    const setup = await startApp();
    const setupToken = setup.getPlaintextForTests();
    expect(setupToken).toBeTruthy();
    const hashBefore = (await db.repos.setupTokens.getActive())?.tokenHash;
    expect(hashBefore).toBe(hashToken(requireSetupToken(setupToken)));

    await app.close();

    const setup2 = createSetupService({
      db: db.db,
      setupTokenTtlMs: 60 * 60 * 1000,
      nodeEnv: "test",
    });
    app = await buildApp({
      version: "0.1.0-test",
      logger: false,
      database: db,
      setup: setup2,
      env: createTestServerEnv({ PUBLIC_BASE_URL: "http://localhost:5173" }),
    });

    const hashAfter = (await db.repos.setupTokens.getActive())?.tokenHash;
    expect(hashAfter).toBe(hashBefore);
    expect(setup2.getPlaintextForTests()).toBeNull();

    const response = await completeSetup(requireSetupToken(setupToken));
    expect(response.statusCode).toBe(200);
  });

  it("status requests do not rotate the token", async () => {
    const setup = await startApp();
    const hashBefore = (await db.repos.setupTokens.getActive())?.tokenHash;
    expect(hashBefore).toBeTruthy();

    for (let i = 0; i < 5; i += 1) {
      const status = await app.inject({ method: "GET", url: "/api/v1/setup/status" });
      expect(status.statusCode).toBe(200);
      expect(setupStatusResponseSchema.parse(status.json()).setupRequired).toBe(true);
    }

    const issuedAgain = await setup.ensureIssued(
      {
        info() {},
        error() {},
        warn() {},
        debug() {},
        fatal() {},
        trace() {},
        child() {
          return this;
        },
      } as never,
      "http://localhost:5173",
    );
    expect(issuedAgain.created).toBe(false);
    expect((await db.repos.setupTokens.getActive())?.tokenHash).toBe(hashBefore);
  });

  it("failed form validation does not consume the token", async () => {
    const setup = await startApp();
    const setupToken = setup.getPlaintextForTests();
    const { token: csrfToken, cookies } = await issueCsrf();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/setup/complete",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(cookies),
        "x-csrf-token": csrfToken,
      },
      payload: {
        token: setupToken,
        email: "not-an-email",
        displayName: "Admin",
        password: "short",
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: { code: "validation_error" } });
    expect((await db.repos.setupTokens.getActive())?.tokenHash).toBe(
      hashToken(requireSetupToken(setupToken)),
    );

    const retry = await completeSetup(requireSetupToken(setupToken));
    expect(retry.statusCode).toBe(200);
  });

  it("failed database transaction does not consume the token", async () => {
    const setup = await startApp();
    const setupToken = setup.getPlaintextForTests();
    expect(setupToken).toBeTruthy();
    const hashBefore = (await db.repos.setupTokens.getActive())?.tokenHash;

    db.sqlite.pragma("query_only = ON");
    const failed = await completeSetup(requireSetupToken(setupToken));
    db.sqlite.pragma("query_only = OFF");

    expect(failed.statusCode).toBe(500);
    expect(failed.json()).toMatchObject({ error: { code: "server_error" } });
    expect((await db.repos.setupTokens.getActive())?.tokenHash).toBe(hashBefore);
    expect(await db.repos.users.count()).toBe(0);

    const retry = await completeSetup(requireSetupToken(setupToken));
    expect(retry.statusCode).toBe(200);
  });

  it("successful setup invalidates the token and blocks reuse", async () => {
    const setup = await startApp();
    const setupToken = setup.getPlaintextForTests();
    const first = await completeSetup(requireSetupToken(setupToken));
    expect(first.statusCode).toBe(200);
    expect(await db.repos.setupTokens.getActive()).toBeUndefined();

    const reuse = await completeSetup(requireSetupToken(setupToken), {
      email: "other@example.com",
      displayName: "Other",
      password: "another-strong-password",
    });
    expect(reuse.statusCode).toBe(409);
    expect(reuse.json()).toMatchObject({ error: { code: "setup_already_completed" } });
  });

  it("setup is disabled when a user exists", async () => {
    const setup = await startApp();
    await completeSetup(requireSetupToken(setup.getPlaintextForTests()));

    const status = await app.inject({ method: "GET", url: "/api/v1/setup/status" });
    expect(setupStatusResponseSchema.parse(status.json()).setupRequired).toBe(false);
  });

  it("simultaneous completion requests create only one admin", async () => {
    const setup = await startApp();
    const setupToken = setup.getPlaintextForTests();
    expect(setupToken).toBeTruthy();

    const [a, b] = await Promise.all([
      completeSetup(requireSetupToken(setupToken), { email: "a@example.com", displayName: "A" }),
      completeSetup(requireSetupToken(setupToken), { email: "b@example.com", displayName: "B" }),
    ]);

    const statuses = [a.statusCode, b.statusCode].sort();
    expect(statuses).toEqual([200, 409]);
    expect(await db.repos.users.count()).toBe(1);
  });

  it("logs in, serves /me, and logs out", async () => {
    const setup = await startApp();
    await completeSetup(requireSetupToken(setup.getPlaintextForTests()));

    const loginCsrf = await issueCsrf();
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(loginCsrf.cookies),
        "x-csrf-token": loginCsrf.token,
      },
      payload: {
        email: "admin@example.com",
        password: "correct-horse-battery",
      },
    });
    expect(login.statusCode).toBe(200);
    const sessionCookies = {
      ...loginCsrf.cookies,
      ...parseCookies(login),
    };

    const me = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: cookieHeader(sessionCookies) },
    });
    expect(me.statusCode).toBe(200);
    expect(authMeResponseSchema.parse(me.json()).user.email).toBe("admin@example.com");

    const logout = await app.inject({
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: {
        cookie: cookieHeader(sessionCookies),
        "x-csrf-token": sessionCookies[CSRF_COOKIE_NAME] ?? loginCsrf.token,
      },
    });
    expect(logout.statusCode).toBe(200);

    const meAfter = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: { cookie: cookieHeader(sessionCookies) },
    });
    expect(meAfter.statusCode).toBe(401);
  });

  it("rejects login with invalid credentials", async () => {
    const setup = await startApp();
    await completeSetup(requireSetupToken(setup.getPlaintextForTests()));

    const loginCsrf = await issueCsrf();
    const failed = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      headers: {
        "content-type": "application/json",
        cookie: cookieHeader(loginCsrf.cookies),
        "x-csrf-token": loginCsrf.token,
      },
      payload: {
        email: "admin@example.com",
        password: "wrong-password-here",
      },
    });
    expect(failed.statusCode).toBe(401);
    expect(failed.json()).toMatchObject({ error: { code: "invalid_credentials" } });
  });

  it("requires authentication for /api/v1/auth/me", async () => {
    await startApp();
    const me = await app.inject({ method: "GET", url: "/api/v1/auth/me" });
    expect(me.statusCode).toBe(401);
  });

  it("rejects state-changing setup without CSRF", async () => {
    const setup = await startApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/setup/complete",
      headers: { "content-type": "application/json" },
      payload: {
        token: setup.getPlaintextForTests(),
        email: "admin@example.com",
        displayName: "Admin",
        password: "correct-horse-battery",
      },
    });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: { code: "csrf_invalid" } });
  });
});
