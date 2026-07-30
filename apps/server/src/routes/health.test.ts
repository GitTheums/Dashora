import { healthResponseSchema } from "@dashora/shared";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

describe("GET /api/v1/health", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({
      version: "0.1.0-test",
      logger: false,
      corsOrigin: "http://localhost:5173",
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns status, version, and timestamp", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health",
    });

    expect(response.statusCode).toBe(200);
    const body = healthResponseSchema.parse(response.json());
    expect(body.status).toBe("ok");
    expect(body.version).toBe("0.1.0-test");
    expect(Date.parse(body.timestamp)).not.toBeNaN();
  });
});
