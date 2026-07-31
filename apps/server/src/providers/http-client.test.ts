import { afterEach, describe, expect, it, vi } from "vitest";
import { ProviderError } from "./errors.js";
import { createProviderHttpClient } from "./http-client.js";
import { createPinnedDispatcher, pinnedFetch } from "./pinned-dispatcher.js";
import { type MockUpstreamServer, startMockUpstream } from "./test/mock-upstream.js";

describe("provider HTTP client", () => {
  let upstream: MockUpstreamServer;

  afterEach(async () => {
    if (upstream) {
      await upstream.close();
      upstream = undefined as unknown as MockUpstreamServer;
    }
  });

  it("applies the configured user agent and returns text bodies", async () => {
    upstream = await startMockUpstream((req, res) => {
      expect(req.headers["user-agent"]).toBe("Dashora-Test/1.0");
      res.statusCode = 200;
      res.setHeader("etag", '"abc"');
      res.setHeader("last-modified", "Wed, 21 Oct 2015 07:28:00 GMT");
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ ok: true }));
    });

    const client = createProviderHttpClient({
      userAgent: "Dashora-Test/1.0",
      connectTimeoutMs: 1_000,
      requestTimeoutMs: 2_000,
      maxResponseBytes: 10_000,
      maxRedirects: 2,
    });

    const response = await client.request({ url: `${upstream.baseUrl}/data` });
    expect(response.status).toBe(200);
    expect(response.bodyText).toBe('{"ok":true}');
    expect(response.etag).toBe('"abc"');
    expect(response.lastModified).toBe("Wed, 21 Oct 2015 07:28:00 GMT");
    expect(response.headers["authorization"]).toBeUndefined();
  });

  it("redacts authorization response headers", async () => {
    upstream = await startMockUpstream((_req, res) => {
      res.statusCode = 200;
      res.setHeader("authorization", "Bearer secret-token");
      res.setHeader("x-request-id", "req-1");
      res.end("ok");
    });

    const client = createProviderHttpClient({
      userAgent: "Dashora-Test/1.0",
      connectTimeoutMs: 1_000,
      requestTimeoutMs: 2_000,
      maxResponseBytes: 10_000,
      maxRedirects: 2,
    });

    const response = await client.request({ url: `${upstream.baseUrl}/secure` });
    expect(response.headers["authorization"]).toBe("[Redacted]");
    expect(response.headers["x-request-id"]).toBe("req-1");
  });

  it("enforces redirect limits", async () => {
    upstream = await startMockUpstream((req, res) => {
      res.statusCode = 302;
      res.setHeader("location", `${upstream.baseUrl}${req.url ?? "/"}-next`);
      res.end();
    });

    const client = createProviderHttpClient({
      userAgent: "Dashora-Test/1.0",
      connectTimeoutMs: 1_000,
      requestTimeoutMs: 2_000,
      maxResponseBytes: 10_000,
      maxRedirects: 1,
    });

    await expect(client.request({ url: `${upstream.baseUrl}/start` })).rejects.toMatchObject({
      code: "too_many_redirects",
    });
  });

  it("enforces response size limits", async () => {
    upstream = await startMockUpstream((_req, res) => {
      res.statusCode = 200;
      res.end("x".repeat(5_000));
    });

    const client = createProviderHttpClient({
      userAgent: "Dashora-Test/1.0",
      connectTimeoutMs: 1_000,
      requestTimeoutMs: 2_000,
      maxResponseBytes: 100,
      maxRedirects: 1,
    });

    await expect(client.request({ url: `${upstream.baseUrl}/big` })).rejects.toBeInstanceOf(
      ProviderError,
    );
    await expect(client.request({ url: `${upstream.baseUrl}/big` })).rejects.toMatchObject({
      code: "too_large",
    });
  });

  it("sends conditional validators", async () => {
    upstream = await startMockUpstream((req, res) => {
      expect(req.headers["if-none-match"]).toBe('"etag-1"');
      expect(req.headers["if-modified-since"]).toBe("Wed, 21 Oct 2015 07:28:00 GMT");
      res.statusCode = 304;
      res.end();
    });

    const client = createProviderHttpClient({
      userAgent: "Dashora-Test/1.0",
      connectTimeoutMs: 1_000,
      requestTimeoutMs: 2_000,
      maxResponseBytes: 10_000,
      maxRedirects: 1,
    });

    const response = await client.request({
      url: `${upstream.baseUrl}/cached`,
      etag: '"etag-1"',
      lastModified: "Wed, 21 Oct 2015 07:28:00 GMT",
    });
    expect(response.notModified).toBe(true);
    expect(response.status).toBe(304);
  });

  it("cancels when the platform signal aborts", async () => {
    const controller = new AbortController();
    upstream = await startMockUpstream(async (_req, res) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      res.statusCode = 200;
      res.end("late");
    });

    const client = createProviderHttpClient({
      userAgent: "Dashora-Test/1.0",
      connectTimeoutMs: 5_000,
      requestTimeoutMs: 5_000,
      maxResponseBytes: 10_000,
      maxRedirects: 1,
      signal: controller.signal,
    });

    const pending = client.request({ url: `${upstream.baseUrl}/slow` });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: expect.stringMatching(/abort|cancelled/) });
  });

  it("pins the connection to validateUrl's resolved address (DNS-rebinding protection)", async () => {
    upstream = await startMockUpstream((_req, res) => {
      res.statusCode = 200;
      res.end("pinned-ok");
    });
    const port = new URL(upstream.baseUrl).port;

    const client = createProviderHttpClient({
      userAgent: "Dashora-Test/1.0",
      connectTimeoutMs: 1_000,
      requestTimeoutMs: 2_000,
      maxResponseBytes: 10_000,
      maxRedirects: 1,
    });

    // "localhost" is not a literal IP, so the underlying connector must go through our custom
    // lookup rather than short-circuiting — this proves the pinned address is actually used to
    // connect, not just recorded.
    const response = await client.request({
      url: `http://localhost:${port}/pinned`,
      validateUrl: async () => ({ addresses: ["127.0.0.1"] }),
    });

    expect(response.status).toBe(200);
    expect(response.bodyText).toBe("pinned-ok");
  });

  it("preserves the original Host header when connecting through a pinned address", async () => {
    upstream = await startMockUpstream((req, res) => {
      expect(req.headers.host).toMatch(/^localhost:\d+$/);
      res.statusCode = 200;
      res.end("host-ok");
    });
    const port = new URL(upstream.baseUrl).port;

    const client = createProviderHttpClient({
      userAgent: "Dashora-Test/1.0",
      connectTimeoutMs: 1_000,
      requestTimeoutMs: 2_000,
      maxResponseBytes: 10_000,
      maxRedirects: 1,
    });

    const response = await client.request({
      url: `http://localhost:${port}/host`,
      validateUrl: async () => ({ addresses: ["127.0.0.1"] }),
    });

    expect(response.status).toBe(200);
    expect(response.bodyText).toBe("host-ok");
  });

  it("fails the connection when the pinned address does not actually serve the host", async () => {
    upstream = await startMockUpstream((_req, res) => {
      res.statusCode = 200;
      res.end("should-not-be-reached");
    });
    const port = new URL(upstream.baseUrl).port;

    const client = createProviderHttpClient({
      userAgent: "Dashora-Test/1.0",
      connectTimeoutMs: 1_000,
      requestTimeoutMs: 2_000,
      maxResponseBytes: 10_000,
      maxRedirects: 1,
    });

    // Even though real DNS for "localhost" would resolve to 127.0.0.1 (where the upstream is
    // actually listening), the pinned dispatcher must only ever use the address we hand it —
    // proving it overrides resolution rather than falling back to it.
    await expect(
      client.request({
        url: `http://localhost:${port}/pinned`,
        validateUrl: async () => ({ addresses: ["127.0.0.2"] }),
      }),
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it("revalidates redirect targets and re-pins each hop", async () => {
    upstream = await startMockUpstream((req, res) => {
      if (req.url === "/start") {
        res.statusCode = 302;
        res.setHeader("location", `${upstream.baseUrl}/final`);
        res.end();
        return;
      }
      res.statusCode = 200;
      res.end("redirect-ok");
    });
    const port = new URL(upstream.baseUrl).port;
    const validated: string[] = [];

    const client = createProviderHttpClient({
      userAgent: "Dashora-Test/1.0",
      connectTimeoutMs: 1_000,
      requestTimeoutMs: 2_000,
      maxResponseBytes: 10_000,
      maxRedirects: 2,
    });

    const response = await client.request({
      url: `http://localhost:${port}/start`,
      validateUrl: async (url) => {
        validated.push(url);
        return { addresses: ["127.0.0.1"] };
      },
    });

    expect(response.status).toBe(200);
    expect(response.bodyText).toBe("redirect-ok");
    expect(response.redirected).toBe(true);
    expect(validated).toEqual([`http://localhost:${port}/start`, `http://127.0.0.1:${port}/final`]);
  });

  it("cleans up a pinned Agent after an aborted request", async () => {
    const controller = new AbortController();
    upstream = await startMockUpstream(async (_req, res) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      res.statusCode = 200;
      res.end("late");
    });
    const port = new URL(upstream.baseUrl).port;

    const client = createProviderHttpClient({
      userAgent: "Dashora-Test/1.0",
      connectTimeoutMs: 5_000,
      requestTimeoutMs: 5_000,
      maxResponseBytes: 10_000,
      maxRedirects: 1,
    });

    const pending = client.request({
      url: `http://localhost:${port}/slow-pin`,
      signal: controller.signal,
      validateUrl: async () => ({ addresses: ["127.0.0.1"] }),
    });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ code: expect.stringMatching(/abort|cancelled/) });
  });

  it("completes successfully through pinnedFetch + pinned Agent without open handles", async () => {
    upstream = await startMockUpstream((_req, res) => {
      res.statusCode = 200;
      res.end("direct-ok");
    });
    const port = new URL(upstream.baseUrl).port;
    const dispatcher = createPinnedDispatcher("localhost", ["127.0.0.1"]);

    try {
      const response = await pinnedFetch(`http://localhost:${port}/direct`, {
        dispatcher,
        redirect: "manual",
      });
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("direct-ok");
    } finally {
      await dispatcher.close();
      await dispatcher.destroy();
    }
  });
});

describe("pinned dispatcher Undici handler contract", () => {
  it("forwards onError exactly once on connection failure", async () => {
    const dispatcher = createPinnedDispatcher("localhost", ["127.0.0.2"]);
    const onError = vi.fn();
    const onConnect = vi.fn();
    const onHeaders = vi.fn();
    const onData = vi.fn();
    const onComplete = vi.fn();

    try {
      await new Promise<void>((resolve, reject) => {
        const result = dispatcher.dispatch(
          {
            origin: "http://localhost:1",
            path: "/",
            method: "GET",
          },
          {
            onConnect(abort) {
              onConnect(abort);
            },
            onError(error) {
              onError(error);
              resolve();
            },
            onHeaders() {
              onHeaders();
              return false;
            },
            onData(chunk) {
              onData(chunk);
              return true;
            },
            onComplete(trailers) {
              onComplete(trailers);
              reject(new Error("expected onError, got onComplete"));
            },
          },
        );
        if (result === false) {
          reject(new Error("dispatch returned false unexpectedly"));
        }
      });

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onComplete).not.toHaveBeenCalled();
      expect(onError.mock.calls[0]?.[0]).toBeInstanceOf(Error);
    } finally {
      await dispatcher.close();
      await dispatcher.destroy();
    }
  });

  it("invokes onComplete on a successful pinned request", async () => {
    const upstream = await startMockUpstream((_req, res) => {
      res.statusCode = 200;
      res.end("done");
    });
    const port = new URL(upstream.baseUrl).port;
    const dispatcher = createPinnedDispatcher("localhost", ["127.0.0.1"]);
    const onComplete = vi.fn();
    const onError = vi.fn();
    const chunks: Buffer[] = [];

    try {
      await new Promise<void>((resolve, reject) => {
        dispatcher.dispatch(
          {
            origin: `http://localhost:${port}`,
            path: "/ok",
            method: "GET",
          },
          {
            onConnect() {},
            onError(error) {
              onError(error);
              reject(error);
            },
            onHeaders() {
              return true;
            },
            onData(chunk) {
              chunks.push(Buffer.from(chunk));
              return true;
            },
            onComplete(trailers) {
              onComplete(trailers);
              resolve();
            },
          },
        );
      });

      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(onError).not.toHaveBeenCalled();
      expect(Buffer.concat(chunks).toString("utf8")).toBe("done");
    } finally {
      await dispatcher.close();
      await dispatcher.destroy();
      await upstream.close();
    }
  });
});
