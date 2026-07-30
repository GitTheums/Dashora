import type { WidgetCacheStatus } from "../../cache.js";
import { defineWidgetProvider } from "../../provider.js";
import {
  type RssConfig,
  type RssData,
  type RssFeedResult,
  type RssItem,
  rssConfigSchema,
  rssDataSchema,
} from "./config.js";
import { RSS_WIDGET_ID } from "./definition.js";
import type { RssFeedFetcher, RssRawItem } from "./fetcher.js";
import {
  normalizeLinkForDedupe,
  parseFeedDate,
  sanitizeHttpUrl,
  stripHtmlToText,
} from "./sanitize.js";

export type RssProviderDeps = {
  fetcher: RssFeedFetcher;
};

function itemId(feedId: string, raw: RssRawItem, index: number): string {
  const basis = raw.guid || raw.link || raw.title || `item-${index}`;
  const cleaned = basis.replace(/\s+/g, " ").trim().slice(0, 160);
  return `${feedId}:${cleaned}`;
}

function sanitizeItem(
  feedId: string,
  feedTitle: string,
  raw: RssRawItem,
  index: number,
  showThumbnails: boolean,
): RssItem | null {
  const title = stripHtmlToText(raw.title, 240);
  if (!title) {
    return null;
  }
  const link = sanitizeHttpUrl(raw.link);
  const summary = stripHtmlToText(raw.summary, 500);
  const thumbnailUrl = showThumbnails ? sanitizeHttpUrl(raw.thumbnailUrl) : null;
  return {
    id: itemId(feedId, raw, index),
    title,
    link,
    summary,
    publishedAt: parseFeedDate(raw.publishedAt),
    feedId,
    feedTitle,
    thumbnailUrl,
  };
}

function mergeCacheStatus(statuses: WidgetCacheStatus[]): WidgetCacheStatus {
  if (statuses.length === 0) {
    return "miss";
  }
  if (statuses.every((status) => status === "hit")) {
    return "hit";
  }
  if (statuses.some((status) => status === "stale")) {
    return "stale";
  }
  if (statuses.some((status) => status === "bypass")) {
    return "bypass";
  }
  return "miss";
}

export function createRssProvider(deps: RssProviderDeps) {
  return defineWidgetProvider<RssConfig, RssData>({
    id: RSS_WIDGET_ID,
    fetch: async (ctx) => {
      const config = rssConfigSchema.parse(ctx.config);

      if (!config.enabled) {
        return { state: "disabled", message: "RSS is disabled in settings." };
      }

      if (config.feeds.length === 0) {
        return {
          state: "configuration-required",
          message: "Add at least one feed URL in settings.",
        };
      }

      const now = ctx.now?.() ?? new Date();
      const feedResults: RssFeedResult[] = [];
      const collected: RssItem[] = [];
      const cacheStatuses: WidgetCacheStatus[] = [];
      let failedFeedCount = 0;

      await Promise.all(
        config.feeds.map(async (feedConfig) => {
          const override = feedConfig.titleOverride.trim();
          const fallbackTitle = override || "Feed";
          const limit = feedConfig.itemLimit ?? config.defaultItemLimit;

          try {
            const result = await deps.fetcher.fetchFeed(feedConfig.url, {
              ...(ctx.signal ? { signal: ctx.signal } : {}),
              ...(ctx.forceRefresh !== undefined ? { forceRefresh: ctx.forceRefresh } : {}),
            });
            cacheStatuses.push(result.cacheStatus);

            const feedTitle = override || stripHtmlToText(result.feed.title, 120) || fallbackTitle;
            const items: RssItem[] = [];
            for (let index = 0; index < result.feed.items.length && items.length < limit; index++) {
              const raw = result.feed.items[index];
              if (!raw) {
                continue;
              }
              const item = sanitizeItem(
                feedConfig.id,
                feedTitle,
                raw,
                index,
                config.showThumbnails,
              );
              if (item) {
                items.push(item);
              }
            }

            collected.push(...items);
            feedResults.push({
              id: feedConfig.id,
              url: feedConfig.url,
              title: feedTitle,
              status: items.length === 0 ? "empty" : "ok",
              itemCount: items.length,
              cacheStatus: result.cacheStatus,
              ...(items.length === 0 ? { message: "This feed returned no items." } : {}),
            });
          } catch {
            failedFeedCount += 1;
            feedResults.push({
              id: feedConfig.id,
              url: feedConfig.url,
              title: fallbackTitle,
              status: "error",
              message: "Could not load this feed.",
              itemCount: 0,
            });
          }
        }),
      );

      // Stable feed order matching config.
      const orderedFeeds = config.feeds
        .map((feed) => feedResults.find((result) => result.id === feed.id))
        .filter((result): result is RssFeedResult => Boolean(result));

      let items = [...collected].sort((a, b) => {
        const aTime = a.publishedAt ? Date.parse(a.publishedAt) : 0;
        const bTime = b.publishedAt ? Date.parse(b.publishedAt) : 0;
        return bTime - aTime;
      });

      if (config.dedupeLinks) {
        const seen = new Set<string>();
        items = items.filter((item) => {
          if (!item.link) {
            return true;
          }
          const key = normalizeLinkForDedupe(item.link);
          if (seen.has(key)) {
            return false;
          }
          seen.add(key);
          return true;
        });
      }

      items = items.slice(0, config.maxItems);

      const data = rssDataSchema.parse({
        layout: config.layout,
        showThumbnails: config.showThumbnails,
        openInNewTab: config.openInNewTab,
        items,
        feeds: orderedFeeds,
        fetchedAt: now.toISOString(),
        failedFeedCount,
      });

      const cacheStatus = mergeCacheStatus(cacheStatuses);

      if (items.length === 0 && failedFeedCount === config.feeds.length) {
        return {
          state: "error",
          data,
          message: "All configured feeds failed to load.",
          errorCode: "rss_all_feeds_failed",
          cacheStatus,
        };
      }

      if (items.length === 0) {
        return {
          state: "empty",
          data,
          message:
            failedFeedCount > 0
              ? "No items to show. Some feeds failed — check settings."
              : "No items were returned by the configured feeds.",
          cacheStatus,
        };
      }

      if (cacheStatus === "stale" || failedFeedCount > 0) {
        return {
          state: "stale",
          data,
          message:
            failedFeedCount > 0
              ? `Showing available items. ${failedFeedCount} feed${failedFeedCount === 1 ? "" : "s"} failed.`
              : "Showing last good feed items while a refresh is due.",
          cacheStatus: cacheStatus === "stale" ? "stale" : cacheStatus,
        };
      }

      if (ctx.forceRefresh) {
        return {
          state: "refreshing",
          data,
          message: "Refreshing feeds…",
          cacheStatus,
        };
      }

      return {
        state: "success",
        data,
        cacheStatus,
      };
    },
  });
}
