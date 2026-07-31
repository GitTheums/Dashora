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
    expect(env.DASHORA_DATA_DIR).toBe("/data");
  });

  it("parses overrides", () => {
    const env = parseServerEnv(
      {
        PORT: "4010",
        HOST: "127.0.0.1",
        LOG_LEVEL: "warn",
        TRUST_PROXY: "true",
        DASHORA_DATA_DIR: "./data",
        COOKIE_SECURE: "true",
        SESSION_TTL_MS: "3600000",
        LOGIN_RATE_LIMIT_MAX: "5",
      },
      { version: "0.1.0" },
    );
    expect(env.PORT).toBe(4010);
    expect(env.HOST).toBe("127.0.0.1");
    expect(env.LOG_LEVEL).toBe("warn");
    expect(env.TRUST_PROXY).toBe(true);
    expect(env.DASHORA_DATA_DIR).toBe("./data");
    expect(env.COOKIE_SECURE).toBe(true);
    expect(env.SESSION_TTL_MS).toBe(3_600_000);
    expect(env.LOGIN_RATE_LIMIT_MAX).toBe(5);
  });

  it("parses provider HTTP defaults", () => {
    const env = parseServerEnv({}, { version: "0.1.0" });
    expect(env.PROVIDER_USER_AGENT).toContain("Dashora/0.1.0");
    expect(env.PROVIDER_USER_AGENT).toContain("https://github.com/GitTheums/Dashora");
    expect(env.PROVIDER_CONNECT_TIMEOUT_MS).toBe(5_000);
    expect(env.PROVIDER_REQUEST_TIMEOUT_MS).toBe(15_000);
    expect(env.PROVIDER_MAX_RESPONSE_BYTES).toBe(2_000_000);
    expect(env.PROVIDER_MAX_REDIRECTS).toBe(5);
    expect(env.PROVIDER_RATE_LIMIT_MAX).toBe(60);
    expect(env.PROVIDER_CIRCUIT_FAILURE_THRESHOLD).toBe(5);
    expect(env.SECRETS_ENCRYPTION_KEY).toBeUndefined();
    expect(env.GITHUB_TOKEN).toBeUndefined();
  });

  it("accepts GitHub secret env overrides", () => {
    const env = parseServerEnv(
      {
        SECRETS_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        GITHUB_TOKEN: "ghp_test_token",
      },
      { version: "0.1.0" },
    );
    expect(env.SECRETS_ENCRYPTION_KEY).toHaveLength(64);
    expect(env.GITHUB_TOKEN).toBe("ghp_test_token");
  });
});
