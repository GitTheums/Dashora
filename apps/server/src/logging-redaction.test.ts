import pino from "pino";
import { describe, expect, it } from "vitest";
import { LOG_REDACT_PATHS } from "./app.js";

/**
 * Exercises the exact redact configuration `buildApp` hands to Fastify's `pino`-backed logger
 * (Fastify constructs its logger with `pino({ level, redact })` under the hood when given a
 * plain options object, so testing `pino()` directly with the same config is equivalent without
 * fighting Fastify's built-in `req`/`res` serializers, which don't apply to arbitrary payloads).
 */
function collectLogLines(write: (log: pino.Logger) => void): Record<string, unknown>[] {
  const chunks: string[] = [];
  const destination = {
    write(chunk: string) {
      chunks.push(chunk);
    },
  };
  const logger = pino(
    { level: "info", redact: { paths: LOG_REDACT_PATHS, censor: "[Redacted]" } },
    destination,
  );
  write(logger);
  return chunks
    .join("")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe("structured log redaction (LOG_REDACT_PATHS)", () => {
  it("does not throw when constructing a logger with the configured redact paths", () => {
    expect(() =>
      pino({ level: "info", redact: { paths: LOG_REDACT_PATHS, censor: "[Redacted]" } }),
    ).not.toThrow();
  });

  it("redacts every configured sensitive request-body field, including nested/array paths", () => {
    const lines = collectLogLines((logger) => {
      logger.info(
        {
          req: {
            headers: {
              authorization: "Bearer super-secret-bearer-token",
              cookie: "session=super-secret-session-cookie",
            },
            body: {
              password: "super-secret-password",
              confirmPassword: "super-secret-confirm-password",
              token: "super-secret-token-value",
              secret: "super-secret-value",
              clientSecret: "super-secret-client-secret",
              value: "super-secret-generic-value",
              username: "super-secret-username",
              csrfToken: "super-secret-csrf-token",
              headers: [{ name: "X-Api-Key", value: "super-secret-header-value" }],
              widgets: [
                { config: { headers: [{ name: "X-Api-Key", value: "super-secret-nested" }] } },
              ],
              harmlessField: "this-is-fine-to-log",
            },
          },
        },
        "test body log",
      );
    });

    const serialized = JSON.stringify(lines);
    for (const secret of [
      "super-secret-bearer-token",
      "super-secret-session-cookie",
      "super-secret-password",
      "super-secret-confirm-password",
      "super-secret-token-value",
      "super-secret-value",
      "super-secret-client-secret",
      "super-secret-generic-value",
      "super-secret-csrf-token",
      "super-secret-header-value",
      "super-secret-nested",
      "super-secret-username",
    ]) {
      expect(serialized).not.toContain(secret);
    }
    // Sanity check: redaction must not swallow the entire log line — non-sensitive fields and
    // the redaction marker itself should still be present, proving the assertions above aren't
    // passing vacuously because nothing was logged at all.
    expect(serialized).toContain("this-is-fine-to-log");
    expect(serialized).toContain("[Redacted]");
  });

  it("redacts response set-cookie headers", () => {
    const lines = collectLogLines((logger) => {
      logger.info(
        { res: { headers: { "set-cookie": "session=super-secret-response-cookie" } } },
        "response log",
      );
    });
    const serialized = JSON.stringify(lines);
    expect(serialized).not.toContain("super-secret-response-cookie");
    expect(serialized).toContain("[Redacted]");
  });
});
