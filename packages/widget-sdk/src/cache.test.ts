import { describe, expect, it } from "vitest";
import {
  DEFAULT_WIDGET_CACHE_POLICY,
  DEFAULT_WIDGET_REFRESH_POLICY,
  widgetCachePolicySchema,
  widgetCacheStatusSchema,
  widgetRefreshPolicySchema,
} from "./cache.js";

describe("widget cache policy schemas", () => {
  it("parses defaults for cache and refresh policies", () => {
    expect(widgetCachePolicySchema.parse({ ttlSeconds: 60 })).toEqual(DEFAULT_WIDGET_CACHE_POLICY);
    expect(widgetRefreshPolicySchema.parse({ defaultIntervalSeconds: 60 })).toEqual(
      DEFAULT_WIDGET_REFRESH_POLICY,
    );
  });

  it("rejects out-of-range TTL and refresh values", () => {
    expect(widgetCachePolicySchema.safeParse({ ttlSeconds: -1 }).success).toBe(false);
    expect(widgetCachePolicySchema.safeParse({ ttlSeconds: 86_401 }).success).toBe(false);
    expect(
      widgetRefreshPolicySchema.safeParse({
        defaultIntervalSeconds: 60,
        minManualIntervalSeconds: 3601,
      }).success,
    ).toBe(false);
  });

  it("accepts known cache statuses", () => {
    for (const status of ["hit", "miss", "stale", "bypass"] as const) {
      expect(widgetCacheStatusSchema.parse(status)).toBe(status);
    }
    expect(widgetCacheStatusSchema.safeParse("warm").success).toBe(false);
  });
});
