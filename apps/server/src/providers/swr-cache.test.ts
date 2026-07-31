import { afterEach, describe, expect, it } from "vitest";
import { type TestDatabase, createTestDatabase } from "../db/test-utils.js";
import { createCacheMetrics } from "./metrics.js";
import {
  type StoredHttpCachePayload,
  buildHttpCacheKey,
  createProviderSwrCache,
} from "./swr-cache.js";

const payload: StoredHttpCachePayload = {
  kind: "http-response",
  url: "https://example.test/feed",
  status: 200,
  headers: { "content-type": "application/json" },
  bodyText: '{"ok":true}',
  etag: '"abc"',
  lastModified: "Wed, 01 Jan 2025 00:00:00 GMT",
};

describe("provider SWR cache", () => {
  let db: TestDatabase;
  let now = 1_000_000;

  afterEach(() => {
    db?.cleanup();
  });

  function createCache() {
    db = createTestDatabase();
    const metrics = createCacheMetrics();
    const cache = createProviderSwrCache({
      repository: db.repos.cacheEntries,
      metrics,
      now: () => now,
    });
    return { cache, metrics };
  }

  it("builds stable keys from provider, method, and URL", () => {
    const a = buildHttpCacheKey("rss", "GET", "https://example.test/a");
    const b = buildHttpCacheKey("rss", "get", "https://example.test/a");
    const c = buildHttpCacheKey("rss", "GET", "https://example.test/b");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a.startsWith("provider-http:rss:")).toBe(true);
  });

  it("returns miss, hit, stale, then miss across the SWR window", async () => {
    const { cache, metrics } = createCache();
    const key = buildHttpCacheKey("hn", "GET", payload.url);

    expect((await cache.lookup(key)).status).toBe("miss");

    await cache.store(key, payload, { ttlSeconds: 10, staleWhileRevalidateSeconds: 20 });
    now = 1_000_000 + 5_000;
    const hit = await cache.lookup(key);
    expect(hit.status).toBe("hit");
    if (hit.status === "hit") {
      expect(hit.payload.bodyText).toBe(payload.bodyText);
      expect(hit.validators.etag).toBe('"abc"');
    }

    now = 1_000_000 + 15_000;
    const stale = await cache.lookup(key);
    expect(stale.status).toBe("stale");

    now = 1_000_000 + 40_000;
    expect((await cache.lookup(key)).status).toBe("miss");

    const snapshot = metrics.snapshot();
    expect(snapshot.hits).toBe(1);
    expect(snapshot.stales).toBe(1);
    expect(snapshot.misses).toBeGreaterThanOrEqual(2);
    expect(snapshot.stores).toBe(1);
  });

  it("treats corrupt payloads as misses", async () => {
    const { cache } = createCache();
    const key = buildHttpCacheKey("bad", "GET", "https://example.test/bad");
    await db.repos.cacheEntries.upsertByCacheKey({
      cacheKey: key,
      payload: { not: "http-response" },
      fetchedAt: now,
      staleAt: now + 10_000,
      expiresAt: now + 20_000,
      widgetId: null,
    });
    expect((await cache.lookup(key)).status).toBe("miss");
  });

  it("refreshes TTL on not-modified touches", async () => {
    const { cache, metrics } = createCache();
    const key = buildHttpCacheKey("etag", "GET", payload.url);
    await cache.store(key, payload, { ttlSeconds: 10, staleWhileRevalidateSeconds: 5 });
    now = 1_000_000 + 1_000;
    await cache.touchNotModified(key, payload, {
      ttlSeconds: 10,
      staleWhileRevalidateSeconds: 5,
    });
    expect(metrics.snapshot().notModified).toBe(1);
    expect(metrics.snapshot().stores).toBe(2);
  });
});
