import type { WidgetCacheStatus } from "../../cache.js";

/** Raw item from an upstream RSS/Atom parse before widget sanitization. */
export type RssRawItem = {
  title?: string;
  link?: string;
  summary?: string;
  publishedAt?: string;
  guid?: string;
  thumbnailUrl?: string;
};

export type RssRawFeed = {
  type: "rss" | "atom";
  title?: string;
  link?: string;
  items: RssRawItem[];
};

export type RssFeedFetchResult = {
  feed: RssRawFeed;
  cacheStatus: WidgetCacheStatus;
};

/**
 * Fetches and parses a single feed URL. Failures should throw so the widget
 * provider can isolate errors per feed.
 */
export type RssFeedFetcher = {
  fetchFeed: (
    url: string,
    options?: { signal?: AbortSignal; forceRefresh?: boolean },
  ) => Promise<RssFeedFetchResult>;
};
