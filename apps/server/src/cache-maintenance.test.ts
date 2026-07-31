import { afterEach, describe, expect, it, vi } from "vitest";
import { startCacheMaintenance } from "./cache-maintenance.js";
import { createRepositories } from "./db/repositories/index.js";
import { type TestDatabase, createTestDatabase } from "./db/test-utils.js";

describe("cache maintenance", () => {
  let db: TestDatabase | undefined;

  afterEach(() => {
    if (db) {
      db.cleanup();
      db = undefined;
    }
  });

  it("deletes expired entries on each tick", async () => {
    db = createTestDatabase();
    const repos = createRepositories(db.db);
    await repos.cacheEntries.upsertByCacheKey({
      cacheKey: "expired",
      payload: {
        kind: "http-response",
        url: "https://example.test",
        status: 200,
        headers: {},
        bodyText: "x",
      },
      fetchedAt: 1,
      staleAt: 2,
      expiresAt: 3,
    });
    await repos.cacheEntries.upsertByCacheKey({
      cacheKey: "fresh",
      payload: {
        kind: "http-response",
        url: "https://example.test/2",
        status: 200,
        headers: {},
        bodyText: "y",
      },
      fetchedAt: 1,
      staleAt: 100_000,
      expiresAt: 200_000,
    });

    const onPurged = vi.fn();
    const stop = startCacheMaintenance({
      repository: repos.cacheEntries,
      intervalMs: 60_000,
      now: () => 10,
      onPurged,
    });

    await vi.waitFor(() => {
      expect(onPurged).toHaveBeenCalledWith(1);
    });
    expect(await repos.cacheEntries.findByCacheKey("expired")).toBeUndefined();
    expect(await repos.cacheEntries.findByCacheKey("fresh")).toBeTruthy();
    stop();
  });
});
