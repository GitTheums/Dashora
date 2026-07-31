import { afterEach, describe, expect, it } from "vitest";
import { createTestServerEnv } from "../../test/env.js";
import { createProviderPlatform } from "../platform.js";
import { startMockUpstream } from "../test/mock-upstream.js";
import { createHackerNewsAdapter } from "./api.js";

const fixtures = {
  topstories: [101, 102],
  item101: {
    id: 101,
    by: "alice",
    time: 1_722_340_800,
    title: "Fixture story",
    url: "https://example.test/a",
    score: 10,
    descendants: 3,
    type: "story",
  },
  item102: {
    id: 102,
    by: "bob",
    time: 1_722_340_900,
    title: "Ask HN: Fixture?",
    score: 5,
    descendants: 1,
    type: "story",
  },
};

describe("hacker-news adapter", () => {
  let closeUpstream: (() => Promise<void>) | undefined;

  afterEach(async () => {
    if (closeUpstream) {
      await closeUpstream();
      closeUpstream = undefined;
    }
  });

  it("loads stories from the Firebase-style JSON API fixtures", async () => {
    const upstream = await startMockUpstream((req, res) => {
      const url = req.url ?? "";
      res.setHeader("content-type", "application/json");
      if (url.includes("/topstories.json")) {
        res.end(JSON.stringify(fixtures.topstories));
        return;
      }
      if (url.includes("/item/101.json")) {
        res.end(JSON.stringify(fixtures.item101));
        return;
      }
      if (url.includes("/item/102.json")) {
        res.end(JSON.stringify(fixtures.item102));
        return;
      }
      res.statusCode = 404;
      res.end("{}");
    });
    closeUpstream = upstream.close;

    const platform = createProviderPlatform({ env: createTestServerEnv() });
    const adapter = createHackerNewsAdapter({ platform, baseUrl: `${upstream.baseUrl}/v0` });
    const result = await adapter.fetchStories({ feed: "top", limit: 2 });

    expect(result.stories).toHaveLength(2);
    expect(result.stories[0]?.title).toBe("Fixture story");
    expect(result.stories[0]?.hnUrl).toContain("item?id=101");
    expect(result.stories[0]?.domain).toBe("example.test");
  });

  it("maps 403 responses to a clear forbidden error", async () => {
    const upstream = await startMockUpstream((_req, res) => {
      res.statusCode = 403;
      res.end("blocked");
    });
    closeUpstream = upstream.close;

    const platform = createProviderPlatform({ env: createTestServerEnv() });
    const adapter = createHackerNewsAdapter({ platform, baseUrl: `${upstream.baseUrl}/v0` });

    await expect(adapter.fetchStories({ feed: "top", limit: 1 })).rejects.toMatchObject({
      code: "forbidden",
      providerId: "hacker-news",
    });
  });
});
