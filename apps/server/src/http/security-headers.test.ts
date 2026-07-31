import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { createTestServerEnv } from "../test/env.js";

describe("security response headers", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it("sends a deny-by-default header set on every response, including unauthenticated ones", async () => {
    app = await buildApp({
      version: "0.1.0-test",
      logger: false,
      env: createTestServerEnv(),
    });

    const response = await app.inject({ method: "GET", url: "/api/v1/health" });

    expect(response.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(response.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(response.headers["x-frame-options"]).toBe("DENY");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
    expect(response.headers["cross-origin-resource-policy"]).toBe("same-origin");
    expect(response.headers["permissions-policy"]).toContain("geolocation=()");
  });

  it("does not send HSTS when the connection is not treated as HTTPS", async () => {
    app = await buildApp({
      version: "0.1.0-test",
      logger: false,
      env: createTestServerEnv({ COOKIE_SECURE: false, NODE_ENV: "development" }),
    });

    const response = await app.inject({ method: "GET", url: "/api/v1/health" });
    expect(response.headers["strict-transport-security"]).toBeUndefined();
  });

  it("sends HSTS when cookies are marked secure", async () => {
    app = await buildApp({
      version: "0.1.0-test",
      logger: false,
      env: createTestServerEnv({ COOKIE_SECURE: true, HSTS_MAX_AGE_SECONDS: 1000 }),
    });

    const response = await app.inject({ method: "GET", url: "/api/v1/health" });
    expect(response.headers["strict-transport-security"]).toContain("max-age=1000");
  });
});
