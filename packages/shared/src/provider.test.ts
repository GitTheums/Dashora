import { describe, expect, it } from "vitest";
import {
  providerCacheMetricsSchema,
  providerDiagnosticsResponseSchema,
  providerErrorCodeSchema,
  providerSafeErrorSchema,
} from "./provider.js";

describe("provider schemas", () => {
  it("accepts known operator-safe error codes", () => {
    expect(providerErrorCodeSchema.parse("ssrf_blocked")).toBe("ssrf_blocked");
    expect(providerErrorCodeSchema.parse("rate_limited")).toBe("rate_limited");
    expect(providerErrorCodeSchema.safeParse("secret_leaked").success).toBe(false);
  });

  it("accepts safe error objects", () => {
    const parsed = providerSafeErrorSchema.parse({
      code: "timeout",
      message: "Upstream timed out",
    });
    expect(parsed.message).toBe("Upstream timed out");
  });

  it("accepts cache metrics snapshots", () => {
    const parsed = providerCacheMetricsSchema.parse({
      hits: 3,
      misses: 1,
      stales: 2,
      bypasses: 0,
      stores: 4,
      notModified: 1,
      entryCount: 2,
      hitRate: 0.833,
    });
    expect(parsed.hits).toBe(3);
    expect(parsed.hitRate).toBeCloseTo(0.833);
  });

  it("accepts a diagnostics response envelope", () => {
    const parsed = providerDiagnosticsResponseSchema.parse({
      generatedAt: "2026-07-31T09:00:00.000Z",
      cancelled: false,
      platform: {
        userAgent: "Dashora/0.1.0",
        connectTimeoutMs: 2000,
        requestTimeoutMs: 5000,
        maxResponseBytes: 1_000_000,
        maxRedirects: 3,
      },
      cache: {
        hits: 0,
        misses: 0,
        stales: 0,
        bypasses: 0,
        stores: 0,
        notModified: 0,
      },
      providers: [
        {
          id: "hacker-news",
          status: "healthy",
          circuitState: "closed",
          rateLimit: { limit: 60, remaining: 59, windowMs: 60_000 },
          timings: {
            lastSuccessAt: "2026-07-31T09:00:00.000Z",
            lastFailureAt: null,
            lastDurationMs: 42,
            averageDurationMs: 40,
          },
          counters: {
            requests: 1,
            successes: 1,
            failures: 0,
            rateLimited: 0,
            circuitRejected: 0,
            deduplicated: 0,
          },
          lastError: null,
        },
      ],
    });
    expect(parsed.providers[0]?.id).toBe("hacker-news");
  });
});
