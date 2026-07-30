import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./env.js";
import { healthResponseSchema } from "./health.js";

describe("healthResponseSchema", () => {
  it("accepts a valid health payload", () => {
    const parsed = healthResponseSchema.parse({
      status: "ok",
      version: "0.1.0",
      timestamp: "2026-07-30T06:00:00.000Z",
    });
    expect(parsed.status).toBe("ok");
  });

  it("rejects an invalid status", () => {
    expect(() =>
      healthResponseSchema.parse({
        status: "down",
        version: "0.1.0",
        timestamp: "2026-07-30T06:00:00.000Z",
      }),
    ).toThrow();
  });
});

describe("parseServerEnv", () => {
  it("applies defaults", () => {
    const env = parseServerEnv({}, { version: "0.1.0" });
    expect(env.PORT).toBe(3000);
    expect(env.APP_VERSION).toBe("0.1.0");
    expect(env.NODE_ENV).toBe("development");
  });

  it("parses overrides", () => {
    const env = parseServerEnv(
      {
        PORT: "4010",
        HOST: "127.0.0.1",
        LOG_LEVEL: "warn",
        TRUST_PROXY: "true",
      },
      { version: "0.1.0" },
    );
    expect(env.PORT).toBe(4010);
    expect(env.HOST).toBe("127.0.0.1");
    expect(env.LOG_LEVEL).toBe("warn");
    expect(env.TRUST_PROXY).toBe(true);
  });
});
