import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { registerHealthRoutes } from "./routes/health.js";

export type BuildAppOptions = {
  version: string;
  logger?: boolean | { level: string };
  trustProxy?: boolean;
  corsOrigin?: string;
};

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? true,
    trustProxy: options.trustProxy ?? false,
  });

  await app.register(cors, {
    origin: options.corsOrigin ?? false,
  });

  await registerHealthRoutes(app, { version: options.version });

  return app;
}
