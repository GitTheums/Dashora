import { describe, expect, it, vi } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import type { RedditAdapter } from "./adapter.js";
import { FeedAdapterError } from "./adapter.js";
import {
  REDDIT_DEFAULT_CONFIG,
  type RedditSubredditConfig,
  isRedditConfigured,
  redditConfigSchema,
} from "./config.js";
import { redditDefinition } from "./definition.js";
import { createRedditProvider } from "./provider.js";

const subredditA: RedditSubredditConfig = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "programming",
  sort: "hot",
  label: "Programming",
  itemLimit: 5,
};

const subredditB: RedditSubredditConfig = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "technology",
  sort: "new",
  label: "",
  itemLimit: 5,
};

function createAdapter(overrides: Partial<RedditAdapter> = {}): RedditAdapter {
  return {
    id: "fake-reddit",
    isConfigured: vi.fn(() => true),
    fetchSubreddit: vi.fn(async (request) => ({
      posts: [
        {
          id: request.name === "technology" ? "t1" : "p1",
          title: `Post from r/${request.name}`,
          url: `https://example.test/${request.name}`,
          permalinkUrl: `https://www.reddit.com/r/${request.name}/comments/p1/post/`,
          score: 100,
          commentCount: 12,
          author: "alice",
          subreddit: request.name,
          publishedAt: "2026-07-30T10:00:00.000Z",
          thumbnailUrl: "https://cdn.example.test/thumb.jpg",
        },
      ],
      cacheStatus: "miss" as const,
    })),
    ...overrides,
  };
}

describe("reddit definition", () => {
  it("covers every required runtime state", () => {
    expect(redditDefinition.states).toEqual(REQUIRED_WIDGET_STATES);
    expect(redditDefinition.id).toBe("reddit");
    expect(redditDefinition.capabilities.requiresIntegration).toBe(true);
  });

  it("parses default config", () => {
    expect(redditConfigSchema.parse({})).toEqual(REDDIT_DEFAULT_CONFIG);
  });

  it("isRedditConfigured requires subreddits", () => {
    expect(isRedditConfigured(REDDIT_DEFAULT_CONFIG)).toBe(false);
    expect(isRedditConfigured({ ...REDDIT_DEFAULT_CONFIG, subreddits: [subredditA] })).toBe(true);
  });
});

describe("reddit provider", () => {
  it("returns disabled when enabled is false", async () => {
    const provider = createRedditProvider({
      adapter: createAdapter(),
      resolveCredentials: () => ({ clientId: "id", clientSecret: "secret" }),
    });
    const result = await provider.fetch({
      instanceId: "r1",
      config: { ...REDDIT_DEFAULT_CONFIG, enabled: false, subreddits: [subredditA] },
    });
    expect(result.state).toBe("disabled");
  });

  it("returns configuration-required when no subreddits are configured", async () => {
    const provider = createRedditProvider({
      adapter: createAdapter(),
      resolveCredentials: () => ({ clientId: "id", clientSecret: "secret" }),
    });
    const result = await provider.fetch({
      instanceId: "r2",
      config: REDDIT_DEFAULT_CONFIG,
    });
    expect(result.state).toBe("configuration-required");
  });

  it("returns configuration-required when credentials are missing", async () => {
    const provider = createRedditProvider({
      adapter: createAdapter({ isConfigured: vi.fn(() => false) }),
      resolveCredentials: () => null,
    });
    const result = await provider.fetch({
      instanceId: "r3",
      config: { ...REDDIT_DEFAULT_CONFIG, subreddits: [subredditA] },
    });
    expect(result.state).toBe("configuration-required");
    expect(result.message).toMatch(/REDDIT_CLIENT_ID/);
  });

  it("returns success with sanitized posts and safe links", async () => {
    const provider = createRedditProvider({
      adapter: createAdapter({
        fetchSubreddit: vi.fn(async () => ({
          posts: [
            {
              id: "p1",
              title: "Hello <b>Reddit</b>",
              url: "https://example.test/post",
              permalinkUrl: "https://www.reddit.com/r/programming/comments/p1/hello/",
              score: 42,
              commentCount: 7,
              author: "alice",
              subreddit: "programming",
              publishedAt: "2026-07-30T10:00:00.000Z",
              thumbnailUrl: "https://cdn.example.test/thumb.jpg",
            },
          ],
          cacheStatus: "miss" as const,
        })),
      }),
      resolveCredentials: () => ({ clientId: "id", clientSecret: "secret" }),
    });
    const result = await provider.fetch({
      instanceId: "r4",
      config: { ...REDDIT_DEFAULT_CONFIG, subreddits: [subredditA] },
    });
    expect(result.state).toBe("success");
    expect(result.data?.items[0]?.title).toBe("Hello Reddit");
    expect(result.data?.items[0]?.url).toBe("https://example.test/post");
  });

  it("isolates failures per subreddit and still returns partial data", async () => {
    const provider = createRedditProvider({
      adapter: createAdapter({
        fetchSubreddit: vi.fn(async (request) => {
          if (request.name === "technology") {
            throw new FeedAdapterError("not_found", "Subreddit not found.", {
              providerId: "reddit",
              statusCode: 404,
            });
          }
          return {
            posts: [
              {
                id: "p1",
                title: "Only programming",
                url: "https://example.test/p",
                permalinkUrl: "https://www.reddit.com/r/programming/comments/p1/only/",
                score: 1,
                commentCount: 0,
                author: "alice",
                subreddit: "programming",
                publishedAt: "2026-07-30T10:00:00.000Z",
                thumbnailUrl: null,
              },
            ],
            cacheStatus: "miss" as const,
          };
        }),
      }),
      resolveCredentials: () => ({ clientId: "id", clientSecret: "secret" }),
    });
    const result = await provider.fetch({
      instanceId: "r5",
      config: {
        ...REDDIT_DEFAULT_CONFIG,
        subreddits: [subredditA, subredditB],
      },
    });
    expect(result.state).toBe("stale");
    expect(result.data?.items).toHaveLength(1);
    expect(result.data?.failedSourceCount).toBe(1);
  });

  it("maps unauthorized adapter errors to configuration-required", async () => {
    const provider = createRedditProvider({
      adapter: createAdapter({
        fetchSubreddit: vi.fn(async () => {
          throw new FeedAdapterError(
            "unauthorized",
            "Reddit rejected the API credentials. Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET on the server.",
            { providerId: "reddit", statusCode: 401 },
          );
        }),
      }),
      resolveCredentials: () => ({ clientId: "id", clientSecret: "secret" }),
    });
    const result = await provider.fetch({
      instanceId: "r6",
      config: { ...REDDIT_DEFAULT_CONFIG, subreddits: [subredditA] },
    });
    expect(result.state).toBe("configuration-required");
  });

  it("maps forbidden adapter errors clearly", async () => {
    const provider = createRedditProvider({
      adapter: createAdapter({
        fetchSubreddit: vi.fn(async () => {
          throw new FeedAdapterError(
            "forbidden",
            "Reddit blocked this request. The OAuth API may have changed access rules.",
            { providerId: "reddit", statusCode: 403 },
          );
        }),
      }),
      resolveCredentials: () => ({ clientId: "id", clientSecret: "secret" }),
    });
    const result = await provider.fetch({
      instanceId: "r7",
      config: { ...REDDIT_DEFAULT_CONFIG, subreddits: [subredditA] },
    });
    expect(result.state).toBe("error");
    expect(result.message).toMatch(/blocked|changed/i);
  });

  it("maps rate_limited adapter errors clearly", async () => {
    const provider = createRedditProvider({
      adapter: createAdapter({
        fetchSubreddit: vi.fn(async () => {
          throw new FeedAdapterError(
            "rate_limited",
            "Reddit API rate limit exceeded. Try again later.",
            { providerId: "reddit", statusCode: 429 },
          );
        }),
      }),
      resolveCredentials: () => ({ clientId: "id", clientSecret: "secret" }),
    });
    const result = await provider.fetch({
      instanceId: "r8",
      config: { ...REDDIT_DEFAULT_CONFIG, subreddits: [subredditA] },
    });
    expect(result.state).toBe("error");
    expect(result.message).toMatch(/rate limit/i);
  });
});
