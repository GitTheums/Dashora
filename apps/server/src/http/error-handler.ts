import type { FastifyError, FastifyInstance } from "fastify";

/**
 * Generic message returned to clients for any error that wasn't raised via `sendApiError`.
 * Never includes the original message or stack — those are logged server-side only.
 */
const GENERIC_MESSAGE = "An unexpected error occurred. Please try again later.";

/**
 * Global Fastify error handler: logs the full error (with stack) server-side, and always
 * returns a generic, stack-free error envelope to the client — regardless of NODE_ENV.
 * Fastify-native errors with a valid HTTP status (validation, payload-too-large, rate-limit,
 * not-found) keep their status code and a safe generic message per status class; everything
 * else is treated as a 500.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({ err: error }, "Unhandled request error");

    const statusCode =
      typeof error.statusCode === "number" && error.statusCode >= 400 && error.statusCode < 600
        ? error.statusCode
        : 500;

    if (statusCode === 413) {
      return reply.status(413).send({
        error: { code: "payload_too_large", message: "Request body is too large." },
      });
    }
    if (statusCode === 429) {
      return reply.status(429).send({
        error: { code: "rate_limited", message: "Too many requests. Try again later." },
      });
    }
    if (statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send({
        error: { code: "bad_request", message: "The request could not be processed." },
      });
    }

    return reply.status(500).send({
      error: { code: "internal_error", message: GENERIC_MESSAGE },
    });
  });

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({
      error: { code: "not_found", message: "The requested resource was not found." },
    });
  });
}
