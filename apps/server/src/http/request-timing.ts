import type { FastifyInstance } from "fastify";

const REQUEST_START = Symbol("dashora.requestStart");

type TimedRequest = {
  [REQUEST_START]?: number;
};

/**
 * Emits a `Server-Timing` response header with application handling duration.
 * Does not log bodies, cookies, or authorization material.
 */
export function registerRequestTiming(app: FastifyInstance): void {
  app.addHook("onRequest", async (request) => {
    (request as TimedRequest)[REQUEST_START] = performance.now();
  });

  app.addHook("onResponse", async (request, reply) => {
    const started = (request as TimedRequest)[REQUEST_START];
    if (started === undefined) {
      return;
    }
    const durationMs = Math.round((performance.now() - started) * 1000) / 1000;
    const appTiming = formatServerTiming(durationMs);
    const existing = reply.getHeader("Server-Timing");
    if (typeof existing === "string" && existing.length > 0) {
      reply.header("Server-Timing", `${existing}, ${appTiming}`);
    } else {
      reply.header("Server-Timing", appTiming);
    }
  });
}

/** Formats a Server-Timing header value for the application phase. */
export function formatServerTiming(durationMs: number): string {
  return `app;dur=${durationMs}`;
}
