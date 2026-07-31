import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
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

function requireSetupToken(token: string | null): string {
  if (!token) {
    throw new Error("expected setup token plaintext from ensureIssued");
  }
  return token;
}

function expectRateLimited(response: LightMyRequestResponse, messageMatch: RegExp): void {
  expect(response.statusCode).toBe(429);
  expect(response.json()).toMatchObject({
    error: { code: "rate_limited", message: expect.stringMatching(messageMatch) },
  });
  const retryAfter = response.headers["retry-after"];
  expect(retryAfter).toBeDefined();
  expect(Number(retryAfter)).toBeGreaterThan(0);
  expect(JSON.stringify(response.json()).toLowerCase()).not.toContain("exists");
  expect(JSON.stringify(response.json()).toLowerCase()).not.toContain("unknown user");
}

describe("auth route rate limiting", () => {
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
      API_RATE_LIMIT_MAX: 10_000,
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
    return { setup, env };
  }

  async function issueCsrf(): Promise<{ token: string; cookies: Record<string, string> }> {
    const response = await app.inject({ method: "GET", url: "/api/v1/auth/csrf" });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { csrfToken: string };
    const cookies = parseCookies(response);
    return { token: body.csrfToken, cookies };
  }

  describe("POST /api/v1/auth/login", () => {
    it("allows requests below the limit and returns 429 when exceeded", async () => {
      const { setup } = await startApp({
        LOGIN_RATE_LIMIT_MAX: 3,
        LOGIN_RATE_LIMIT_WINDOW_MS: 60_000,
      });
      const token = requireSetupToken(setup.getPlaintextForTests());
      const csrf = await issueCsrf();
      await app.inject({
        method: "POST",
        url: "/api/v1/setup/complete",
        headers: {
          "content-type": "application/json",
          cookie: cookieHeader(csrf.cookies),
          "x-csrf-token": csrf.token,
        },
        payload: {
          token,
          email: "admin@example.com",
          displayName: "Admin",
          password: "correct-horse-battery",
        },
      });

      for (let i = 0; i < 3; i += 1) {
        const loginCsrf = await issueCsrf();
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          remoteAddress: "203.0.113.10",
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
        expect(response.statusCode).toBe(401);
        expect(response.json()).toMatchObject({ error: { code: "invalid_credentials" } });
      }

      const limitedCsrf = await issueCsrf();
      const limited = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        remoteAddress: "203.0.113.10",
        headers: {
          "content-type": "application/json",
          cookie: cookieHeader(limitedCsrf.cookies),
          "x-csrf-token": limitedCsrf.token,
        },
        payload: {
          email: "admin@example.com",
          password: "wrong-password-here",
        },
      });
      expectRateLimited(limited, /login attempts/i);
    });

    it("does not allow casing or whitespace to bypass the login limit", async () => {
      const { setup } = await startApp({
        LOGIN_RATE_LIMIT_MAX: 2,
        LOGIN_RATE_LIMIT_WINDOW_MS: 60_000,
      });
      const token = requireSetupToken(setup.getPlaintextForTests());
      const csrf = await issueCsrf();
      await app.inject({
        method: "POST",
        url: "/api/v1/setup/complete",
        headers: {
          "content-type": "application/json",
          cookie: cookieHeader(csrf.cookies),
          "x-csrf-token": csrf.token,
        },
        payload: {
          token,
          email: "admin@example.com",
          displayName: "Admin",
          password: "correct-horse-battery",
        },
      });

      const firstCsrf = await issueCsrf();
      const first = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        remoteAddress: "203.0.113.20",
        headers: {
          "content-type": "application/json",
          cookie: cookieHeader(firstCsrf.cookies),
          "x-csrf-token": firstCsrf.token,
        },
        payload: { email: "admin@example.com", password: "wrong-password-here" },
      });
      expect(first.statusCode).toBe(401);

      // Whitespace around the address is normalized in the rate-limit key (may fail Zod).
      const paddedCsrf = await issueCsrf();
      const padded = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        remoteAddress: "203.0.113.20",
        headers: {
          "content-type": "application/json",
          cookie: cookieHeader(paddedCsrf.cookies),
          "x-csrf-token": paddedCsrf.token,
        },
        payload: { email: "  Admin@Example.com  ", password: "wrong-password-here" },
      });
      expect([400, 401]).toContain(padded.statusCode);

      const limitedCsrf = await issueCsrf();
      const limited = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        remoteAddress: "203.0.113.20",
        headers: {
          "content-type": "application/json",
          cookie: cookieHeader(limitedCsrf.cookies),
          "x-csrf-token": limitedCsrf.token,
        },
        payload: {
          email: "ADMIN@example.com",
          password: "wrong-password-here",
        },
      });
      expectRateLimited(limited, /login attempts/i);
    });

    it("isolates clients by IP and still allows successful login under the limit", async () => {
      const { setup } = await startApp({
        LOGIN_RATE_LIMIT_MAX: 2,
        LOGIN_RATE_LIMIT_WINDOW_MS: 60_000,
      });
      const token = requireSetupToken(setup.getPlaintextForTests());
      const csrf = await issueCsrf();
      await app.inject({
        method: "POST",
        url: "/api/v1/setup/complete",
        headers: {
          "content-type": "application/json",
          cookie: cookieHeader(csrf.cookies),
          "x-csrf-token": csrf.token,
        },
        payload: {
          token,
          email: "admin@example.com",
          displayName: "Admin",
          password: "correct-horse-battery",
        },
      });

      for (let i = 0; i < 2; i += 1) {
        const loginCsrf = await issueCsrf();
        await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          remoteAddress: "203.0.113.30",
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
      }

      const otherClientCsrf = await issueCsrf();
      const otherClient = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        remoteAddress: "198.51.100.40",
        headers: {
          "content-type": "application/json",
          cookie: cookieHeader(otherClientCsrf.cookies),
          "x-csrf-token": otherClientCsrf.token,
        },
        payload: {
          email: "admin@example.com",
          password: "correct-horse-battery",
        },
      });
      expect(otherClient.statusCode).toBe(200);
      expect(otherClient.json()).toMatchObject({
        user: { email: "admin@example.com" },
      });
    });

    it("ignores X-Forwarded-For when TRUST_PROXY is disabled", async () => {
      const { setup } = await startApp({
        TRUST_PROXY: false,
        LOGIN_RATE_LIMIT_MAX: 2,
        LOGIN_RATE_LIMIT_WINDOW_MS: 60_000,
      });
      const token = requireSetupToken(setup.getPlaintextForTests());
      const csrf = await issueCsrf();
      await app.inject({
        method: "POST",
        url: "/api/v1/setup/complete",
        headers: {
          "content-type": "application/json",
          cookie: cookieHeader(csrf.cookies),
          "x-csrf-token": csrf.token,
        },
        payload: {
          token,
          email: "admin@example.com",
          displayName: "Admin",
          password: "correct-horse-battery",
        },
      });

      for (let i = 0; i < 2; i += 1) {
        const loginCsrf = await issueCsrf();
        await app.inject({
          method: "POST",
          url: "/api/v1/auth/login",
          remoteAddress: "203.0.113.50",
          headers: {
            "content-type": "application/json",
            cookie: cookieHeader(loginCsrf.cookies),
            "x-csrf-token": loginCsrf.token,
            "x-forwarded-for": `198.51.100.${i + 1}`,
          },
          payload: {
            email: "admin@example.com",
            password: "wrong-password-here",
          },
        });
      }

      const limitedCsrf = await issueCsrf();
      const limited = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        remoteAddress: "203.0.113.50",
        headers: {
          "content-type": "application/json",
          cookie: cookieHeader(limitedCsrf.cookies),
          "x-csrf-token": limitedCsrf.token,
          "x-forwarded-for": "203.0.113.99",
        },
        payload: {
          email: "admin@example.com",
          password: "wrong-password-here",
        },
      });
      expectRateLimited(limited, /login attempts/i);
    });

    it("resets after the configured window", async () => {
      const { setup } = await startApp({
        LOGIN_RATE_LIMIT_MAX: 1,
        LOGIN_RATE_LIMIT_WINDOW_MS: 200,
      });
      const token = requireSetupToken(setup.getPlaintextForTests());
      const csrf = await issueCsrf();
      await app.inject({
        method: "POST",
        url: "/api/v1/setup/complete",
        headers: {
          "content-type": "application/json",
          cookie: cookieHeader(csrf.cookies),
          "x-csrf-token": csrf.token,
        },
        payload: {
          token,
          email: "admin@example.com",
          displayName: "Admin",
          password: "correct-horse-battery",
        },
      });

      const firstCsrf = await issueCsrf();
      const first = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        remoteAddress: "203.0.113.60",
        headers: {
          "content-type": "application/json",
          cookie: cookieHeader(firstCsrf.cookies),
          "x-csrf-token": firstCsrf.token,
        },
        payload: {
          email: "admin@example.com",
          password: "wrong-password-here",
        },
      });
      expect(first.statusCode).toBe(401);

      const limitedCsrf = await issueCsrf();
      const limited = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        remoteAddress: "203.0.113.60",
        headers: {
          "content-type": "application/json",
          cookie: cookieHeader(limitedCsrf.cookies),
          "x-csrf-token": limitedCsrf.token,
        },
        payload: {
          email: "admin@example.com",
          password: "wrong-password-here",
        },
      });
      expectRateLimited(limited, /login attempts/i);

      await new Promise((resolve) => setTimeout(resolve, 250));

      const afterCsrf = await issueCsrf();
      const after = await app.inject({
        method: "POST",
        url: "/api/v1/auth/login",
        remoteAddress: "203.0.113.60",
        headers: {
          "content-type": "application/json",
          cookie: cookieHeader(afterCsrf.cookies),
          "x-csrf-token": afterCsrf.token,
        },
        payload: {
          email: "admin@example.com",
          password: "wrong-password-here",
        },
      });
      expect(after.statusCode).toBe(401);
    });
  });

  describe("POST /api/v1/setup/complete", () => {
    it("rate limits setup completion attempts", async () => {
      await startApp({
        SETUP_RATE_LIMIT_MAX: 2,
        SETUP_RATE_LIMIT_WINDOW_MS: 60_000,
      });

      for (let i = 0; i < 2; i += 1) {
        const csrf = await issueCsrf();
        const response = await app.inject({
          method: "POST",
          url: "/api/v1/setup/complete",
          remoteAddress: "203.0.113.70",
          headers: {
            "content-type": "application/json",
            cookie: cookieHeader(csrf.cookies),
            "x-csrf-token": csrf.token,
          },
          payload: {
            token: "not-a-valid-setup-token",
            email: "operator@example.com",
            displayName: "Operator",
            password: "correct-horse-battery",
          },
        });
        expect([400, 403]).toContain(response.statusCode);
      }

      const limitedCsrf = await issueCsrf();
      const limited = await app.inject({
        method: "POST",
        url: "/api/v1/setup/complete",
        remoteAddress: "203.0.113.70",
        headers: {
          "content-type": "application/json",
          cookie: cookieHeader(limitedCsrf.cookies),
          "x-csrf-token": limitedCsrf.token,
        },
        payload: {
          token: "not-a-valid-setup-token",
          email: "  Operator@Example.com ",
          displayName: "Operator",
          password: "correct-horse-battery",
        },
      });
      expectRateLimited(limited, /setup attempts/i);
    });
  });

  describe("GET /api/v1/auth/me", () => {
    it("rate limits unauthenticated session probes", async () => {
      await startApp({
        AUTH_ME_RATE_LIMIT_MAX: 2,
        AUTH_ME_RATE_LIMIT_WINDOW_MS: 60_000,
      });

      for (let i = 0; i < 2; i += 1) {
        const response = await app.inject({
          method: "GET",
          url: "/api/v1/auth/me",
          remoteAddress: "203.0.113.80",
        });
        expect(response.statusCode).toBe(401);
      }

      const limited = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        remoteAddress: "203.0.113.80",
      });
      expectRateLimited(limited, /session checks/i);

      const otherClient = await app.inject({
        method: "GET",
        url: "/api/v1/auth/me",
        remoteAddress: "198.51.100.80",
      });
      expect(otherClient.statusCode).toBe(401);
    });
  });
});
