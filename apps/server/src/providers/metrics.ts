import type { ProviderCacheMetrics } from "@dashora/shared";

export type CacheMetricEvent = "hit" | "miss" | "stale" | "bypass" | "store" | "not_modified";

export function createCacheMetrics() {
  const counters: ProviderCacheMetrics = {
    hits: 0,
    misses: 0,
    stales: 0,
    bypasses: 0,
    stores: 0,
    notModified: 0,
  };

  function record(event: CacheMetricEvent): void {
    switch (event) {
      case "hit":
        counters.hits += 1;
        break;
      case "miss":
        counters.misses += 1;
        break;
      case "stale":
        counters.stales += 1;
        break;
      case "bypass":
        counters.bypasses += 1;
        break;
      case "store":
        counters.stores += 1;
        break;
      case "not_modified":
        counters.notModified += 1;
        break;
    }
  }

  function snapshot(entryCount?: number): ProviderCacheMetrics {
    return {
      ...counters,
      ...(entryCount !== undefined ? { entryCount } : {}),
    };
  }

  function reset(): void {
    counters.hits = 0;
    counters.misses = 0;
    counters.stales = 0;
    counters.bypasses = 0;
    counters.stores = 0;
    counters.notModified = 0;
  }

  return { record, snapshot, reset };
}

export type CacheMetrics = ReturnType<typeof createCacheMetrics>;
