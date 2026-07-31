import { afterEach, describe, expect, it } from "vitest";
import { createTestServerEnv } from "../../test/env.js";
import { createProviderPlatform } from "../platform.js";
import { startMockUpstream } from "../test/mock-upstream.js";
import { createLobstersAdapter } from "./api.js";

const fixtures = {
  hottest: [
    {
      short_id: "abc123",
      title: "Fixture story",
      url: "https://example.test/a",
      comments_url: "https://lobste.rs/s/abc123/fixture-story",
      score: 10,
      comment_count: 3,
      submitter_user: { username: "alice" },
      created_at: "2026-07-30T10:00:00.000Z",
      tags: ["rust", "programming"],
    },
    {
      short_id: "def456",
      title: "Second fixture",
      url: "https://example.test/b",
      comments_url: "https://lobste.rs/s/def456/second-fixture",
      score: 5,
      comment_count: 1,
      submitter_user: { username: "bob" },
      created_at: "2026-07-30T09:00:00.000Z",
      tags: ["go"],
    },
  ],
  tagRust: [
    {
      short_id: "tag1",
      title: "Rust tagged story",
      url: "https://example.test/rust",
      comments_url: "https://lobste.rs/s/tag1/rust-tagged-story",
      score: 8,
      comment_count: 2,
      submitter_user: { username: "carol" },
      created_at: "2026-07-30T11:00:00.000Z",
      tags: ["rust"],
    },
  ],
};

describe("lobsters adapter", () => {
  let closeUpstream: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (closeUpstream) {
      await closeUpstream();
      closeUpstream = undefined;
    }
  });

  it("loads stories from the hottest.json fixture", async () => {
    const upstream = await startMockUpstream((req, res) => {
      const url = req.url ?? "";
      res.setHeader("content-type", "application/json");
      if (url.includes("/hottest.json")) {
        res.end(JSON.stringify(fixtures.hottest));
        return;
      }
      res.statusCode = 404;
      res.end("{}");
    });
    closeUpstream = upstream.close;

    const platform = createProviderPlatform({ env: createTestServerEnv() });
    const adapter = createLobstersAdapter({ platform, baseUrl: upstream.baseUrl });
    const result = await adapter.fetchSource({ kind: "hottest", limit: 2 });

    expect(result.stories).toHaveLength(2);
    expect(result.stories[0]?.title).toBe("Fixture story");
    expect(result.stories[0]?.commentsUrl).toContain("/s/abc123/");
    expect(result.stories[0]?.author).toBe("alice");
    expect(result.stories[0]?.tags).toEqual(["rust", "programming"]);
  });

  it("loads stories from a tag feed fixture", async () => {
    const upstream = await startMockUpstream((req, res) => {
      const url = req.url ?? "";
      res.setHeader("content-type", "application/json");
      if (url.includes("/t/rust.json")) {
        res.end(JSON.stringify(fixtures.tagRust));
        return;
      }
      res.statusCode = 404;
      res.end("{}");
    });
    closeUpstream = upstream.close;

    const platform = createProviderPlatform({ env: createTestServerEnv() });
    const adapter = createLobstersAdapter({ platform, baseUrl: upstream.baseUrl });
    const result = await adapter.fetchSource({ kind: "tag", tag: "rust", limit: 5 });

    expect(result.stories).toHaveLength(1);
    expect(result.stories[0]?.title).toBe("Rust tagged story");
  });

  it("maps 403 responses to a clear forbidden error", async () => {
    const upstream = await startMockUpstream((_req, res) => {
      res.statusCode = 403;
      res.end("blocked");
    });
    closeUpstream = upstream.close;

    const platform = createProviderPlatform({ env: createTestServerEnv() });
    const adapter = createLobstersAdapter({ platform, baseUrl: upstream.baseUrl });

    await expect(adapter.fetchSource({ kind: "newest", limit: 1 })).rejects.toMatchObject({
      code: "forbidden",
      providerId: "lobsters",
    });
  });

  it("maps 404 responses to not_found", async () => {
    const upstream = await startMockUpstream((_req, res) => {
      res.statusCode = 404;
      res.end("missing");
    });
    closeUpstream = upstream.close;

    const platform = createProviderPlatform({ env: createTestServerEnv() });
    const adapter = createLobstersAdapter({ platform, baseUrl: upstream.baseUrl });

    await expect(
      adapter.fetchSource({ kind: "tag", tag: "missing-tag", limit: 1 }),
    ).rejects.toMatchObject({
      code: "not_found",
      providerId: "lobsters",
    });
  });
});
