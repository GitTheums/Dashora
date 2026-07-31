import { afterEach, describe, expect, it, vi } from "vitest";
import { createRepositories } from "../db/repositories/index.js";
import { type TestDatabase, createTestDatabase } from "../db/test-utils.js";
import { createTestServerEnv } from "../test/env.js";
import { ProviderError } from "./errors.js";
import { createProviderPlatform } from "./platform.js";
import { type MockUpstreamServer, startMockUpstream } from "./test/mock-upstream.js";

describe("provider platform", () => {
  let db: TestDatabase | undefined;
  let upstream: MockUpstreamServer | undefined;

  afterEach(async () => {
    if (upstream) {
      await upstream.close();
      upstream = undefined;
    }
    if (db) {
      db.cleanup();
      db = undefined;
    }
  });

  function createPlatform(overrides: Parameters<typeof createTestServerEnv>[0] = {}) {
    db = createTestDatabase();
    const repos = createRepositories(db.db);
    const env = createTestServerEnv(overrides);
    return createProviderPlatform({
      env,
      cacheRepository: repos.cacheEntries,
    });
  }

  it("caches successful GET responses and serves hits", async () => {
    upstream = await startMockUpstream((_req, res) => {
      res.statusCode = 200;
      res.setHeader("etag", '"v1"');
      res.end(JSON.stringify({ value: 1 }));
    });
    const platform = createPlatform({
      PROVIDER_CACHE_TTL_SECONDS: 60,
      PROVIDER_CACHE_SWR_SECONDS: 120,
    });

    const first = await platform.fetchJson<{ value: number }>({
      providerId: "demo",
      url: `${upstream.baseUrl}/json`,
    });
    expect(first.data.value).toBe(1);
    expect(first.result.cacheStatus).toBe("miss");
    expect(upstream.requestCount()).toBe(1);

    const second = await platform.fetchJson<{ value: number }>({
      providerId: "demo",
      url: `${upstream.baseUrl}/json`,
    });
    expect(second.data.value).toBe(1);
    expect(second.result.cacheStatus).toBe("hit");
    expect(second.result.fromCache).toBe(true);
    expect(upstream.requestCount()).toBe(1);

    const metrics = (await platform.getDiagnostics()).cache;
    expect(metrics.hits).toBeGreaterThanOrEqual(1);
    expect(metrics.stores).toBeGreaterThanOrEqual(1);
    expect(metrics.entryCount).toBeGreaterThanOrEqual(1);
    expect(metrics.hitRate ?? 0).toBeGreaterThan(0);
  });

  it("returns stale immediately and revalidates in the background", async () => {
    let body = { value: 1 };
    let releaseRevalidate: (() => void) | undefined;
    const revalidateGate = new Promise<void>((resolve) => {
      releaseRevalidate = resolve;
    });
    upstream = await startMockUpstream(async (req, res) => {
      if (req.headers["if-none-match"] === '"v1"') {
        await revalidateGate;
        res.statusCode = 304;
        res.end();
        return;
      }
      res.statusCode = 200;
      res.setHeader("etag", '"v1"');
      res.end(JSON.stringify(body));
    });

    let now = 1_000;
    db = createTestDatabase();
    const repos = createRepositories(db.db);
    const platform = createProviderPlatform({
      env: createTestServerEnv({
        PROVIDER_CACHE_TTL_SECONDS: 1,
        PROVIDER_CACHE_SWR_SECONDS: 60,
      }),
      cacheRepository: repos.cacheEntries,
      now: () => now,
    });

    await platform.fetchJson({
      providerId: "weather",
      url: `${upstream.baseUrl}/wx`,
    });

    now = 1_000 + 1_500;
    body = { value: 2 };
    const beforeBackground = upstream.requestCount();
    // Resolves while background revalidation is intentionally blocked — proves SWR
    // does not wait on upstream before returning stale.
    const stale = await platform.fetchJson<{ value: number }>({
      providerId: "weather",
      url: `${upstream.baseUrl}/wx`,
    });
    expect(stale.data.value).toBe(1);
    expect(stale.result.cacheStatus).toBe("stale");
    expect(stale.result.fromCache).toBe(true);

    releaseRevalidate?.();
    await vi.waitFor(() => {
      expect(upstream?.requestCount()).toBeGreaterThan(beforeBackground);
    });
  });

  it("deduplicates concurrent identical requests", async () => {
    upstream = await startMockUpstream(async (_req, res) => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      res.statusCode = 200;
      res.end("shared");
    });
    const platform = createPlatform();

    const [a, b] = await Promise.all([
      platform.fetchText({ providerId: "rss", url: `${upstream.baseUrl}/feed` }),
      platform.fetchText({ providerId: "rss", url: `${upstream.baseUrl}/feed` }),
    ]);

    expect(a.text).toBe("shared");
    expect(b.text).toBe("shared");
    expect(upstream.requestCount()).toBe(1);
    const entry = (await platform.getDiagnostics()).providers.find((p) => p.id === "rss");
    expect(entry?.counters.deduplicated).toBeGreaterThanOrEqual(1);
  });

  it("rate limits per provider", async () => {
    upstream = await startMockUpstream((_req, res) => {
      res.statusCode = 200;
      res.end("ok");
    });
    const platform = createPlatform({
      PROVIDER_RATE_LIMIT_MAX: 2,
      PROVIDER_RATE_LIMIT_WINDOW_MS: 60_000,
      PROVIDER_CACHE_TTL_SECONDS: 0,
      PROVIDER_CACHE_SWR_SECONDS: 0,
    });

    await platform.fetchText({
      providerId: "limited",
      url: `${upstream.baseUrl}/a`,
      forceRefresh: true,
    });
    await platform.fetchText({
      providerId: "limited",
      url: `${upstream.baseUrl}/b`,
      forceRefresh: true,
    });
    await expect(
      platform.fetchText({
        providerId: "limited",
        url: `${upstream.baseUrl}/c`,
        forceRefresh: true,
      }),
    ).rejects.toMatchObject({ code: "rate_limited" });
  });

  it("opens the circuit after repeated failures", async () => {
    upstream = await startMockUpstream((_req, res) => {
      res.statusCode = 500;
      res.end("nope");
    });
    const platform = createPlatform({
      PROVIDER_CIRCUIT_FAILURE_THRESHOLD: 2,
      PROVIDER_CIRCUIT_OPEN_MS: 30_000,
      PROVIDER_CACHE_TTL_SECONDS: 0,
      PROVIDER_CACHE_SWR_SECONDS: 0,
    });

    await expect(
      platform.fetchText({
        providerId: "flaky",
        url: `${upstream.baseUrl}/x`,
        forceRefresh: true,
        retry: false,
      }),
    ).rejects.toBeInstanceOf(ProviderError);

    await expect(
      platform.fetchText({
        providerId: "flaky",
        url: `${upstream.baseUrl}/x`,
        forceRefresh: true,
        retry: false,
      }),
    ).rejects.toBeInstanceOf(ProviderError);

    await expect(
      platform.fetchText({
        providerId: "flaky",
        url: `${upstream.baseUrl}/x`,
        forceRefresh: true,
        retry: false,
      }),
    ).rejects.toMatchObject({ code: "circuit_open" });

    const diagnostics = await platform.getDiagnostics();
    const entry = diagnostics.providers.find((p) => p.id === "flaky");
    expect(entry?.circuitState).toBe("open");
    expect(entry?.status).toBe("open");
    expect(entry?.lastError?.code).toBeTruthy();
    expect(JSON.stringify(diagnostics)).not.toMatch(/Bearer|password|secret-token/i);
  });

  it("parses RSS through the platform helper", async () => {
    upstream = await startMockUpstream((_req, res) => {
      res.statusCode = 200;
      res.setHeader("content-type", "application/rss+xml");
      res.end(`<?xml version="1.0"?><rss version="2.0"><channel><title>T</title>
        <item><title>Item</title></item></channel></rss>`);
    });
    const platform = createPlatform();
    const { feed } = await platform.fetchRss({
      providerId: "news",
      url: `${upstream.baseUrl}/rss`,
    });
    expect(feed.title).toBe("T");
    expect(feed.items[0]?.title).toBe("Item");
  });

  it("cancels in-flight work on shutdown", async () => {
    upstream = await startMockUpstream(async (_req, res) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      res.statusCode = 200;
      res.end("late");
    });
    const platform = createPlatform();
    const pending = platform.fetchText({
      providerId: "shutdown",
      url: `${upstream.baseUrl}/slow`,
      forceRefresh: true,
      retry: false,
    });
    platform.cancel();
    await expect(pending).rejects.toMatchObject({
      code: expect.stringMatching(/cancelled|aborted|timeout/),
    });
    expect(platform.isCancelled()).toBe(true);
  });

  it("exposes structured frontend-safe errors", async () => {
    const error = new ProviderError("http_error", { statusCode: 502 });
    const safe = error.toSafeError();
    expect(safe.code).toBe("http_error");
    expect(safe.message).not.toContain("502");
  });
});
