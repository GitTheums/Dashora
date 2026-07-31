import { defineWidgetProvider } from "../../provider.js";
import { feedAdapterErrorToWidget } from "../_shared/feed-errors.js";
import { parseFeedDate, sanitizeHttpUrl, stripHtmlToText } from "../rss/sanitize.js";
import type { HackerNewsAdapter, HackerNewsStoryPayload } from "./adapter.js";
import {
  type HackerNewsConfig,
  type HackerNewsData,
  type HackerNewsItem,
  hackerNewsConfigSchema,
  hackerNewsDataSchema,
} from "./config.js";
import { HACKER_NEWS_WIDGET_ID } from "./definition.js";

export type HackerNewsProviderDeps = {
  adapter: HackerNewsAdapter;
};

function sanitizeStory(raw: HackerNewsStoryPayload): HackerNewsItem | null {
  const title = stripHtmlToText(raw.title, 240);
  if (!title) {
    return null;
  }
  const hnUrl = sanitizeHttpUrl(raw.hnUrl);
  if (!hnUrl) {
    return null;
  }
  return {
    id: raw.id.slice(0, 32),
    title,
    url: sanitizeHttpUrl(raw.url),
    hnUrl,
    score: Math.max(0, Math.floor(raw.score)),
    commentCount: Math.max(0, Math.floor(raw.commentCount)),
    author: stripHtmlToText(raw.author, 80) || "unknown",
    publishedAt: parseFeedDate(raw.publishedAt),
    domain: raw.domain ? stripHtmlToText(raw.domain, 120) || null : null,
  };
}

export function createHackerNewsProvider(deps: HackerNewsProviderDeps) {
  return defineWidgetProvider<HackerNewsConfig, HackerNewsData>({
    id: HACKER_NEWS_WIDGET_ID,
    fetch: async (ctx) => {
      const config = hackerNewsConfigSchema.parse(ctx.config);

      if (!config.enabled) {
        return { state: "disabled", message: "Hacker News is disabled in settings." };
      }

      const now = ctx.now?.() ?? new Date();

      try {
        const result = await deps.adapter.fetchStories({
          feed: config.feed,
          limit: config.maxItems,
          ...(ctx.signal ? { signal: ctx.signal } : {}),
          ...(ctx.forceRefresh !== undefined ? { forceRefresh: ctx.forceRefresh } : {}),
          now,
        });

        const items = result.stories
          .map(sanitizeStory)
          .filter((item): item is HackerNewsItem => item !== null)
          .slice(0, config.maxItems);

        const data = hackerNewsDataSchema.parse({
          feed: config.feed,
          layout: config.layout,
          showScore: config.showScore,
          showCommentCount: config.showCommentCount,
          openInNewTab: config.openInNewTab,
          items,
          fetchedAt: now.toISOString(),
        });

        if (items.length === 0) {
          return {
            state: "empty",
            data,
            message: "No stories were returned for this feed.",
            cacheStatus: result.cacheStatus,
          };
        }

        if (result.cacheStatus === "stale") {
          return {
            state: "stale",
            data,
            message: "Showing last good Hacker News stories while a refresh is due.",
            cacheStatus: "stale",
          };
        }

        if (ctx.forceRefresh) {
          return {
            state: "refreshing",
            data,
            message: "Refreshing Hacker News…",
            cacheStatus: result.cacheStatus,
          };
        }

        return {
          state: "success",
          data,
          cacheStatus: result.cacheStatus,
        };
      } catch (error) {
        return feedAdapterErrorToWidget(
          error,
          "Could not load Hacker News stories.",
          "hacker_news_fetch_failed",
        );
      }
    },
  });
}
