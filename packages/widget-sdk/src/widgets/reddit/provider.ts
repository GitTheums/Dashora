import type { WidgetCacheStatus } from "../../cache.js";
import { defineWidgetProvider } from "../../provider.js";
import { feedAdapterErrorToWidget, isFeedAdapterError } from "../_shared/feed-errors.js";
import { parseFeedDate, sanitizeHttpUrl, stripHtmlToText } from "../rss/sanitize.js";
import type { RedditAdapter, RedditCredentials, RedditPostPayload } from "./adapter.js";
import {
  type RedditConfig,
  type RedditData,
  type RedditItem,
  type RedditSourceResult,
  isRedditConfigured,
  redditConfigSchema,
  redditDataSchema,
} from "./config.js";
import { REDDIT_WIDGET_ID } from "./definition.js";

export type RedditProviderDeps = {
  adapter: RedditAdapter;
  resolveCredentials?: () => RedditCredentials | null;
};

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

function sourceLabel(name: string, label: string): string {
  const trimmed = label.trim();
  return trimmed || name;
}

function sanitizePost(
  raw: RedditPostPayload,
  sourceId: string,
  sourceLabelText: string,
  showThumbnails: boolean,
): RedditItem | null {
  const title = stripHtmlToText(raw.title, 240);
  if (!title) {
    return null;
  }
  const permalinkUrl = sanitizeHttpUrl(raw.permalinkUrl);
  if (!permalinkUrl) {
    return null;
  }
  return {
    id: raw.id.slice(0, 32),
    title,
    url: sanitizeHttpUrl(raw.url),
    permalinkUrl,
    score: Math.trunc(raw.score),
    commentCount: Math.max(0, Math.trunc(raw.commentCount)),
    author: stripHtmlToText(raw.author, 80) || "unknown",
    subreddit: stripHtmlToText(raw.subreddit, 21) || "unknown",
    publishedAt: parseFeedDate(raw.publishedAt),
    thumbnailUrl: showThumbnails ? sanitizeHttpUrl(raw.thumbnailUrl) : null,
    sourceId,
    sourceLabel: stripHtmlToText(sourceLabelText, 80) || raw.subreddit,
  };
}

function mapSourceError(error: unknown): string {
  if (isFeedAdapterError(error)) {
    if (error.code === "not_found") {
      return "Subreddit not found or is unavailable.";
    }
    if (error.code === "forbidden") {
      return "Reddit blocked this subreddit request. The OAuth API may have changed access rules.";
    }
    if (error.code === "rate_limited") {
      return "Reddit API rate limit exceeded. Try again later.";
    }
    return error.message;
  }
  return "Could not load this subreddit.";
}

function isGlobalCredentialError(error: unknown): boolean {
  return (
    isFeedAdapterError(error) && (error.code === "not_configured" || error.code === "unauthorized")
  );
}

export function createRedditProvider(deps: RedditProviderDeps) {
  return defineWidgetProvider<RedditConfig, RedditData>({
    id: REDDIT_WIDGET_ID,
    fetch: async (ctx) => {
      const config = redditConfigSchema.parse(ctx.config);

      if (!config.enabled) {
        return { state: "disabled", message: "Reddit is disabled in settings." };
      }

      if (!isRedditConfigured(config)) {
        return {
          state: "configuration-required",
          message: "Add at least one subreddit in settings.",
        };
      }

      const credentials = deps.resolveCredentials?.() ?? null;
      if (!deps.adapter.isConfigured(credentials)) {
        return {
          state: "configuration-required",
          message:
            "Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET on the server to load Reddit posts.",
        };
      }

      const now = ctx.now?.() ?? new Date();
      const sourceResults: RedditSourceResult[] = [];
      const collected: RedditItem[] = [];
      const cacheStatuses: WidgetCacheStatus[] = [];
      let failedSourceCount = 0;

      try {
        await Promise.all(
          config.subreddits.map(async (subredditConfig) => {
            const label = sourceLabel(subredditConfig.name, subredditConfig.label);
            const limit = subredditConfig.itemLimit ?? config.defaultItemLimit;

            try {
              const result = await deps.adapter.fetchSubreddit({
                name: subredditConfig.name,
                sort: subredditConfig.sort,
                ...(subredditConfig.sort === "top" && subredditConfig.timeFrame
                  ? { timeFrame: subredditConfig.timeFrame }
                  : {}),
                limit,
                credentials: credentials as RedditCredentials,
                ...(ctx.signal ? { signal: ctx.signal } : {}),
                ...(ctx.forceRefresh !== undefined ? { forceRefresh: ctx.forceRefresh } : {}),
                now,
              });
              cacheStatuses.push(result.cacheStatus);

              const items: RedditItem[] = [];
              for (const raw of result.posts) {
                const item = sanitizePost(raw, subredditConfig.id, label, config.showThumbnails);
                if (item) {
                  items.push(item);
                }
              }

              collected.push(...items);
              sourceResults.push({
                id: subredditConfig.id,
                name: subredditConfig.name,
                label,
                status: items.length === 0 ? "empty" : "ok",
                itemCount: items.length,
                cacheStatus: result.cacheStatus,
                ...(items.length === 0 ? { message: "This subreddit returned no posts." } : {}),
              });
            } catch (error) {
              if (isGlobalCredentialError(error)) {
                throw error;
              }
              failedSourceCount += 1;
              sourceResults.push({
                id: subredditConfig.id,
                name: subredditConfig.name,
                label,
                status: "error",
                message: mapSourceError(error),
                itemCount: 0,
              });
            }
          }),
        );
      } catch (error) {
        return feedAdapterErrorToWidget(
          error,
          "Could not load Reddit posts.",
          "reddit_fetch_failed",
        );
      }

      const orderedSources = config.subreddits
        .map((subreddit) => sourceResults.find((result) => result.id === subreddit.id))
        .filter((result): result is RedditSourceResult => Boolean(result));

      const items = [...collected]
        .sort((a, b) => {
          const aTime = a.publishedAt ? Date.parse(a.publishedAt) : 0;
          const bTime = b.publishedAt ? Date.parse(b.publishedAt) : 0;
          return bTime - aTime;
        })
        .slice(0, config.maxItems);

      const data = redditDataSchema.parse({
        layout: config.layout,
        showThumbnails: config.showThumbnails,
        showScore: config.showScore,
        showCommentCount: config.showCommentCount,
        openInNewTab: config.openInNewTab,
        items,
        sources: orderedSources,
        fetchedAt: now.toISOString(),
        failedSourceCount,
      });

      const cacheStatus = mergeCacheStatus(cacheStatuses);

      if (items.length === 0 && failedSourceCount === config.subreddits.length) {
        const firstFailed = orderedSources.find((source) => source.status === "error");
        return {
          state: "error",
          data,
          message: firstFailed?.message ?? "All configured subreddits failed to load.",
          errorCode: "reddit_all_sources_failed",
          cacheStatus,
        };
      }

      if (items.length === 0) {
        return {
          state: "empty",
          data,
          message:
            failedSourceCount > 0
              ? "No posts to show. Some subreddits failed — check settings."
              : "No posts were returned by the configured subreddits.",
          cacheStatus,
        };
      }

      if (cacheStatus === "stale" || failedSourceCount > 0) {
        return {
          state: "stale",
          data,
          message:
            failedSourceCount > 0
              ? `Showing available posts. ${failedSourceCount} subreddit${failedSourceCount === 1 ? "" : "s"} failed.`
              : "Showing last good Reddit posts while a refresh is due.",
          cacheStatus: cacheStatus === "stale" ? "stale" : cacheStatus,
        };
      }

      if (ctx.forceRefresh) {
        return {
          state: "refreshing",
          data,
          message: "Refreshing Reddit…",
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
