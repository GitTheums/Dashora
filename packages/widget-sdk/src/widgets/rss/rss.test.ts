import { describe, expect, it, vi } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import { RSS_DEFAULT_CONFIG, type RssFeedConfig, newRssFeedId, rssConfigSchema } from "./config.js";
import { rssDefinition } from "./definition.js";
import type { RssFeedFetcher } from "./fetcher.js";
import { createRssProvider } from "./provider.js";
import {
  formatRelativeTimestamp,
  normalizeLinkForDedupe,
  sanitizeHttpUrl,
  stripHtmlToText,
} from "./sanitize.js";

const feedA: RssFeedConfig = {
  id: "11111111-1111-4111-8111-111111111111",
  url: "https://example.test/a.xml",
  titleOverride: "Alpha",
  itemLimit: 5,
};

const feedB: RssFeedConfig = {
  id: "22222222-2222-4222-8222-222222222222",
  url: "https://example.test/b.xml",
  titleOverride: "",
  itemLimit: 5,
};

function createFetcher(overrides: Partial<RssFeedFetcher> = {}): RssFeedFetcher {
  return {
    fetchFeed: vi.fn(async (url: string) => ({
      feed: {
        type: "rss" as const,
        title: url.includes("b.xml") ? "Bravo Feed" : "Alpha Feed",
        items: [
          {
            title: `Story from ${url}`,
            link: "https://example.test/shared",
            summary: "<p>Hello <b>world</b></p>",
            publishedAt: "2026-07-30T10:00:00.000Z",
            thumbnailUrl: "https://cdn.example.test/thumb.jpg",
          },
          {
            title: "Unique",
            link: `https://example.test/${url.includes("b") ? "b" : "a"}-only`,
            publishedAt: "2026-07-30T09:00:00.000Z",
          },
        ],
      },
      cacheStatus: "miss" as const,
    })),
    ...overrides,
  };
}

describe("rss definition", () => {
  it("covers every required runtime state", () => {
    expect(rssDefinition.states).toEqual(REQUIRED_WIDGET_STATES);
    expect(rssDefinition.id).toBe("rss");
  });

  it("parses default config", () => {
    expect(rssConfigSchema.parse({})).toEqual(RSS_DEFAULT_CONFIG);
  });
});

describe("rss sanitization", () => {
  it("strips HTML to plain text", () => {
    expect(stripHtmlToText("<script>alert(1)</script><p>Hi &amp; bye</p>")).toBe("Hi & bye");
  });

  it("rejects unsafe URLs", () => {
    expect(sanitizeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeHttpUrl("https://user:pass@example.com")).toBeNull();
    expect(sanitizeHttpUrl("https://example.com/ok")).toBe("https://example.com/ok");
  });

  it("normalizes links for dedupe", () => {
    expect(normalizeLinkForDedupe("https://Example.com/path/#hash")).toBe(
      "https://example.com/path",
    );
  });

  it("formats relative timestamps", () => {
    const now = Date.parse("2026-07-30T12:00:00.000Z");
    expect(formatRelativeTimestamp("2026-07-30T11:00:00.000Z", now)).toMatch(/hour/i);
  });
});

describe("rss provider", () => {
  it("returns configuration-required without feeds", async () => {
    const provider = createRssProvider({ fetcher: createFetcher() });
    const result = await provider.fetch({
      instanceId: "r1",
      config: RSS_DEFAULT_CONFIG,
    });
    expect(result.state).toBe("configuration-required");
  });

  it("returns disabled when enabled is false", async () => {
    const provider = createRssProvider({ fetcher: createFetcher() });
    const result = await provider.fetch({
      instanceId: "r2",
      config: { ...RSS_DEFAULT_CONFIG, enabled: false, feeds: [feedA] },
    });
    expect(result.state).toBe("disabled");
  });

  it("aggregates feeds, sanitizes HTML, and dedupes links", async () => {
    const provider = createRssProvider({ fetcher: createFetcher() });
    const result = await provider.fetch({
      instanceId: "r3",
      config: {
        ...RSS_DEFAULT_CONFIG,
        feeds: [feedA, feedB],
        dedupeLinks: true,
      },
    });
    expect(result.state).toBe("success");
    expect(result.data?.items.every((item) => !item.summary.includes("<"))).toBe(true);
    const links = result.data?.items.map((item) => item.link).filter(Boolean) ?? [];
    expect(new Set(links).size).toBe(links.length);
    expect(result.data?.feeds).toHaveLength(2);
    expect(result.data?.feeds[0]?.title).toBe("Alpha");
  });

  it("isolates feed failures and returns stale with remaining items", async () => {
    const fetcher = createFetcher({
      fetchFeed: vi.fn(async (url: string) => {
        if (url.includes("b.xml")) {
          throw new Error("boom");
        }
        return {
          feed: {
            type: "rss" as const,
            title: "Alpha Feed",
            items: [
              {
                title: "Surviving item",
                link: "https://example.test/ok",
                publishedAt: "2026-07-30T10:00:00.000Z",
              },
            ],
          },
          cacheStatus: "hit" as const,
        };
      }),
    });
    const provider = createRssProvider({ fetcher });
    const result = await provider.fetch({
      instanceId: "r4",
      config: { ...RSS_DEFAULT_CONFIG, feeds: [feedA, feedB] },
    });
    expect(result.state).toBe("stale");
    expect(result.data?.items).toHaveLength(1);
    expect(result.data?.failedFeedCount).toBe(1);
    expect(result.data?.feeds.find((feed) => feed.id === feedB.id)?.status).toBe("error");
  });

  it("returns error when every feed fails", async () => {
    const fetcher = createFetcher({
      fetchFeed: vi.fn(async () => {
        throw new Error("down");
      }),
    });
    const provider = createRssProvider({ fetcher });
    const result = await provider.fetch({
      instanceId: "r5",
      config: { ...RSS_DEFAULT_CONFIG, feeds: [feedA] },
    });
    expect(result.state).toBe("error");
    expect(result.errorCode).toBe("rss_all_feeds_failed");
  });

  it("uses a generated feed id helper", () => {
    expect(newRssFeedId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
