import { describe, expect, it, vi } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import type { HackerNewsAdapter } from "./adapter.js";
import { FeedAdapterError } from "./adapter.js";
import { HACKER_NEWS_DEFAULT_CONFIG, hackerNewsConfigSchema } from "./config.js";
import { hackerNewsDefinition } from "./definition.js";
import { createHackerNewsProvider } from "./provider.js";

function createAdapter(overrides: Partial<HackerNewsAdapter> = {}): HackerNewsAdapter {
  return {
    id: "fake-hn",
    fetchStories: vi.fn(async () => ({
      stories: [
        {
          id: "1",
          title: "Hello <b>HN</b>",
          url: "https://example.test/post",
          hnUrl: "https://news.ycombinator.com/item?id=1",
          score: 42,
          commentCount: 7,
          author: "alice",
          publishedAt: "2026-07-30T10:00:00.000Z",
          domain: "example.test",
        },
      ],
      cacheStatus: "miss" as const,
    })),
    ...overrides,
  };
}

describe("hacker-news definition", () => {
  it("covers every required runtime state", () => {
    expect(hackerNewsDefinition.states).toEqual(REQUIRED_WIDGET_STATES);
    expect(hackerNewsDefinition.id).toBe("hacker-news");
  });

  it("parses default config", () => {
    expect(hackerNewsConfigSchema.parse({})).toEqual(HACKER_NEWS_DEFAULT_CONFIG);
  });
});

describe("hacker-news provider", () => {
  it("returns disabled when enabled is false", async () => {
    const provider = createHackerNewsProvider({ adapter: createAdapter() });
    const result = await provider.fetch({
      instanceId: "hn1",
      config: { ...HACKER_NEWS_DEFAULT_CONFIG, enabled: false },
    });
    expect(result.state).toBe("disabled");
  });

  it("returns success with sanitized titles and safe links", async () => {
    const provider = createHackerNewsProvider({ adapter: createAdapter() });
    const result = await provider.fetch({
      instanceId: "hn2",
      config: HACKER_NEWS_DEFAULT_CONFIG,
    });
    expect(result.state).toBe("success");
    expect(result.data?.items[0]?.title).toBe("Hello HN");
    expect(result.data?.items[0]?.url).toBe("https://example.test/post");
  });

  it("returns empty when the adapter yields no stories", async () => {
    const provider = createHackerNewsProvider({
      adapter: createAdapter({
        fetchStories: vi.fn(async () => ({ stories: [], cacheStatus: "hit" as const })),
      }),
    });
    const result = await provider.fetch({
      instanceId: "hn3",
      config: HACKER_NEWS_DEFAULT_CONFIG,
    });
    expect(result.state).toBe("empty");
  });

  it("returns stale when the adapter cache is stale", async () => {
    const provider = createHackerNewsProvider({
      adapter: createAdapter({
        fetchStories: vi.fn(async () => ({
          stories: [
            {
              id: "9",
              title: "Cached",
              url: null,
              hnUrl: "https://news.ycombinator.com/item?id=9",
              score: 1,
              commentCount: 0,
              author: "bob",
              publishedAt: "2026-07-30T09:00:00.000Z",
              domain: null,
            },
          ],
          cacheStatus: "stale" as const,
        })),
      }),
    });
    const result = await provider.fetch({
      instanceId: "hn4",
      config: HACKER_NEWS_DEFAULT_CONFIG,
    });
    expect(result.state).toBe("stale");
  });

  it("maps forbidden adapter errors clearly", async () => {
    const provider = createHackerNewsProvider({
      adapter: createAdapter({
        fetchStories: vi.fn(async () => {
          throw new FeedAdapterError(
            "forbidden",
            "Hacker News blocked this request. The Firebase API may have changed access rules.",
            { providerId: "hacker-news", statusCode: 403 },
          );
        }),
      }),
    });
    const result = await provider.fetch({
      instanceId: "hn5",
      config: HACKER_NEWS_DEFAULT_CONFIG,
    });
    expect(result.state).toBe("error");
    expect(result.message).toMatch(/blocked|changed/i);
  });
});
