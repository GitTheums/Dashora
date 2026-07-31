import { describe, expect, it } from "vitest";
import { createCacheMetrics } from "./metrics.js";

describe("cache metrics", () => {
  it("computes hitRate from hits, stales, and misses", () => {
    const metrics = createCacheMetrics();
    metrics.record("hit");
    metrics.record("hit");
    metrics.record("stale");
    metrics.record("miss");
    const snapshot = metrics.snapshot(4);
    expect(snapshot.hitRate).toBeCloseTo(0.75);
    expect(snapshot.entryCount).toBe(4);
  });
});
