import type {
  RssFeedFetchResult,
  RssFeedFetcher,
  RssRawItem,
} from "@dashora/widget-sdk/widgets/rss/server";
import { ProviderError } from "../errors.js";
import type { AtomFeed } from "../parsers/atom.js";
import type { RssFeed } from "../parsers/rss.js";
import type { ProviderPlatform } from "../platform.js";

function detectFeedKind(body: string): "rss" | "atom" | "unknown" {
  const sample = body.slice(0, 2048).toLowerCase();
  if (sample.includes("<rss") || sample.includes("<rdf:rdf") || sample.includes("<rdf")) {
    return "rss";
  }
  if (sample.includes("<feed")) {
    return "atom";
  }
  return "unknown";
}

function fromRss(feed: RssFeed): RssFeedFetchResult["feed"] {
  return {
    type: "rss",
    ...(feed.title ? { title: feed.title } : {}),
    ...(feed.link ? { link: feed.link } : {}),
    items: feed.items.map(
      (item): RssRawItem => ({
        ...(item.title ? { title: item.title } : {}),
        ...(item.link ? { link: item.link } : {}),
        ...(item.description ? { summary: item.description } : {}),
        ...(item.pubDate ? { publishedAt: item.pubDate } : {}),
        ...(item.guid ? { guid: item.guid } : {}),
        ...(item.thumbnailUrl ? { thumbnailUrl: item.thumbnailUrl } : {}),
      }),
    ),
  };
}

function fromAtom(feed: AtomFeed): RssFeedFetchResult["feed"] {
  return {
    type: "atom",
    ...(feed.title ? { title: feed.title } : {}),
    ...(feed.link ? { link: feed.link } : {}),
    items: feed.entries.map((entry): RssRawItem => {
      const summary = entry.summary ?? entry.content;
      return {
        ...(entry.title ? { title: entry.title } : {}),
        ...(entry.link ? { link: entry.link } : {}),
        ...(summary ? { summary } : {}),
        ...(entry.published || entry.updated
          ? { publishedAt: entry.published ?? entry.updated }
          : {}),
        ...(entry.id ? { guid: entry.id } : {}),
        ...(entry.thumbnailUrl ? { thumbnailUrl: entry.thumbnailUrl } : {}),
      };
    }),
  };
}

export function createPlatformRssFeedFetcher(platform: ProviderPlatform): RssFeedFetcher {
  return {
    async fetchFeed(url, options = {}) {
      const { text, result } = await platform.fetchText({
        providerId: "rss",
        url,
        ...(options.signal ? { signal: options.signal } : {}),
        ...(options.forceRefresh !== undefined ? { forceRefresh: options.forceRefresh } : {}),
        cachePolicy: { ttlSeconds: 300, staleWhileRevalidateSeconds: 1200 },
      });

      const kind = detectFeedKind(text);
      try {
        if (kind === "atom") {
          return {
            feed: fromAtom(platform.parsers.parseAtomXml(text)),
            cacheStatus: result.cacheStatus,
          };
        }
        if (kind === "rss") {
          return {
            feed: fromRss(platform.parsers.parseRssXml(text)),
            cacheStatus: result.cacheStatus,
          };
        }
        // Ambiguous: try RSS then Atom.
        try {
          return {
            feed: fromRss(platform.parsers.parseRssXml(text)),
            cacheStatus: result.cacheStatus,
          };
        } catch {
          return {
            feed: fromAtom(platform.parsers.parseAtomXml(text)),
            cacheStatus: result.cacheStatus,
          };
        }
      } catch (error) {
        if (error instanceof ProviderError) {
          throw error;
        }
        throw new ProviderError("parse_error", {
          message: "Upstream feed response could not be parsed as RSS or Atom.",
          cause: error,
        });
      }
    },
  };
}
