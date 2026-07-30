import type { HealthResponse } from "@dashora/shared";
import { healthResponseSchema } from "@dashora/shared";
import type { FastifyInstance } from "fastify";

export type HealthRouteOptions = {
  version: string;
};

export async function registerHealthRoutes(
  app: FastifyInstance,
  options: HealthRouteOptions,
): Promise<void> {
  app.get("/api/v1/health", async (): Promise<HealthResponse> => {
    const payload = healthResponseSchema.parse({
      status: "ok",
      version: options.version,
      timestamp: new Date().toISOString(),
    });
    return payload;
  });
}
