import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { createTestServerEnv } from "../test/env.js";

describe("global error handler", () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it("never leaks the original message or a stack trace for unexpected errors", async () => {
    app = await buildApp({
      version: "0.1.0-test",
      logger: false,
      env: createTestServerEnv(),
    });
    app.get("/__test/throw", async () => {
      throw new Error("sensitive internal detail: connection string leaked here");
    });

    const response = await app.inject({ method: "GET", url: "/__test/throw" });

    expect(response.statusCode).toBe(500);
    const body = response.json();
    expect(body).toEqual({
      error: { code: "internal_error", message: expect.any(String) },
    });
    expect(response.body).not.toContain("sensitive internal detail");
    expect(response.body).not.toContain("connection string");
    expect(response.body.toLowerCase()).not.toContain("stack");
    expect(response.body.toLowerCase()).not.toContain(".ts:");
  });

  it("returns a generic 404 envelope for unknown routes", async () => {
    app = await buildApp({
      version: "0.1.0-test",
      logger: false,
      env: createTestServerEnv(),
    });

    const response = await app.inject({ method: "GET", url: "/api/v1/does-not-exist" });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: "not_found", message: expect.any(String) },
    });
  });

  it("returns a generic 413 envelope when the global body limit is exceeded", async () => {
    app = await buildApp({
      version: "0.1.0-test",
      logger: false,
      env: createTestServerEnv({ MAX_BODY_BYTES: 10 }),
    });

    const response = await app.inject({
      method: "PUT",
      url: "/api/v1/settings/theme",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ mode: "dark", extra: "padding-to-exceed-the-tiny-limit" }),
    });

    expect(response.statusCode).toBe(413);
    expect(response.json()).toEqual({
      error: { code: "payload_too_large", message: expect.any(String) },
    });
  });
});
