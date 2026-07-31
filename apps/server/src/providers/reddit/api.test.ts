import { afterEach, describe, expect, it } from "vitest";
import { createTestServerEnv } from "../../test/env.js";
import { createProviderPlatform } from "../platform.js";
import { startMockUpstream } from "../test/mock-upstream.js";
import { createRedditAdapter, resetRedditTokenCacheForTests } from "./api.js";

const fixtures = {
  token: {
    access_token: "fixture-reddit-token",
    token_type: "bearer",
    expires_in: 3600,
    scope: "*",
  },
  listing: {
    data: {
      children: [
        {
          data: {
            id: "abc123",
            title: "Fixture Reddit post",
            url: "https://example.test/article",
            permalink: "/r/programming/comments/abc123/fixture/",
            score: 128,
            num_comments: 42,
            author: "fixture_user",
            subreddit: "programming",
            created_utc: 1_722_340_800,
            thumbnail: "https://cdn.example.test/thumb.jpg",
          },
        },
        {
          data: {
            id: "def456",
            title: "Self post",
            url: "https://www.reddit.com/r/programming/comments/def456/self/",
            permalink: "/r/programming/comments/def456/self/",
            score: 5,
            num_comments: 1,
            author: "bob",
            subreddit: "programming",
            created_utc: 1_722_340_700,
            thumbnail: "self",
            preview: {
              images: [
                {
                  source: {
                    url: "https://preview.example.test/img.jpg?width=640&amp;format=pjpg",
                  },
                },
              ],
            },
          },
        },
        {
          data: {
            id: "ghi789",
            title: "NSFW placeholder skipped",
            url: "https://example.test/nsfw",
            permalink: "/r/programming/comments/ghi789/nsfw/",
            score: 1,
            num_comments: 0,
            author: "carol",
            subreddit: "programming",
            created_utc: 1_722_340_600,
            thumbnail: "nsfw",
          },
        },
      ],
    },
  },
};

describe("reddit adapter", () => {
  let closeUpstream: (() => Promise<void>) | undefined;

  afterEach(async () => {
    resetRedditTokenCacheForTests();
    if (closeUpstream) {
      await closeUpstream();
      closeUpstream = undefined;
    }
  });

  it("loads posts from OAuth listing fixtures after client_credentials token exchange", async () => {
    const upstream = await startMockUpstream((req, res) => {
      const url = req.url ?? "";
      res.setHeader("content-type", "application/json");
      if (url.includes("/api/v1/access_token")) {
        res.end(JSON.stringify(fixtures.token));
        return;
      }
      if (url.includes("/r/programming/hot.json")) {
        res.end(JSON.stringify(fixtures.listing));
        return;
      }
      res.statusCode = 404;
      res.end("{}");
    });
    closeUpstream = upstream.close;

    const platform = createProviderPlatform({ env: createTestServerEnv() });
    const adapter = createRedditAdapter({
      platform,
      baseUrl: upstream.baseUrl,
      tokenUrl: `${upstream.baseUrl}/api/v1/access_token`,
    });
    const result = await adapter.fetchSubreddit({
      name: "programming",
      sort: "hot",
      limit: 10,
      credentials: { clientId: "fixture-client", clientSecret: "fixture-secret" },
    });

    expect(result.posts.length).toBeGreaterThanOrEqual(2);
    expect(result.posts[0]?.title).toBe("Fixture Reddit post");
    expect(result.posts[0]?.thumbnailUrl).toBe("https://cdn.example.test/thumb.jpg");
    expect(result.posts[0]?.permalinkUrl).toContain("/r/programming/comments/abc123");
    expect(result.posts[1]?.thumbnailUrl).toBe(
      "https://preview.example.test/img.jpg?width=640&format=pjpg",
    );
    expect(result.posts.find((post) => post.id === "ghi789")?.thumbnailUrl).toBeNull();
  });

  it("maps 401 token responses to unauthorized configuration errors", async () => {
    const upstream = await startMockUpstream((_req, res) => {
      res.statusCode = 401;
      res.end("unauthorized");
    });
    closeUpstream = upstream.close;

    const platform = createProviderPlatform({ env: createTestServerEnv() });
    const adapter = createRedditAdapter({
      platform,
      baseUrl: upstream.baseUrl,
      tokenUrl: `${upstream.baseUrl}/api/v1/access_token`,
    });

    await expect(
      adapter.fetchSubreddit({
        name: "programming",
        sort: "hot",
        limit: 1,
        credentials: { clientId: "bad", clientSecret: "bad" },
      }),
    ).rejects.toMatchObject({
      code: "unauthorized",
      providerId: "reddit",
    });
  });

  it("maps 403 listing responses to a clear forbidden error", async () => {
    const upstream = await startMockUpstream((req, res) => {
      const url = req.url ?? "";
      if (url.includes("/api/v1/access_token")) {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(fixtures.token));
        return;
      }
      res.statusCode = 403;
      res.end("blocked");
    });
    closeUpstream = upstream.close;

    const platform = createProviderPlatform({ env: createTestServerEnv() });
    const adapter = createRedditAdapter({
      platform,
      baseUrl: upstream.baseUrl,
      tokenUrl: `${upstream.baseUrl}/api/v1/access_token`,
    });

    await expect(
      adapter.fetchSubreddit({
        name: "programming",
        sort: "hot",
        limit: 1,
        credentials: { clientId: "fixture-client", clientSecret: "fixture-secret" },
      }),
    ).rejects.toMatchObject({
      code: "forbidden",
      providerId: "reddit",
    });
  });

  it("maps 429 responses to rate_limited", async () => {
    const upstream = await startMockUpstream((_req, res) => {
      res.statusCode = 429;
      res.end("slow down");
    });
    closeUpstream = upstream.close;

    const platform = createProviderPlatform({ env: createTestServerEnv() });
    const adapter = createRedditAdapter({
      platform,
      baseUrl: upstream.baseUrl,
      tokenUrl: `${upstream.baseUrl}/api/v1/access_token`,
    });

    await expect(
      adapter.fetchSubreddit({
        name: "programming",
        sort: "hot",
        limit: 1,
        credentials: { clientId: "fixture-client", clientSecret: "fixture-secret" },
      }),
    ).rejects.toMatchObject({
      code: "rate_limited",
      providerId: "reddit",
    });
  });
});
