import type { WidgetCacheStatus } from "../../cache.js";
import { defineWidgetProvider } from "../../provider.js";
import { parseFeedDate, sanitizeHttpUrl, stripHtmlToText } from "../rss/sanitize.js";
import type { LobstersAdapter, LobstersStoryPayload } from "./adapter.js";
import {
  LOBSTERS_SOURCE_KIND_LABELS,
  type LobstersConfig,
  type LobstersData,
  type LobstersItem,
  type LobstersSourceConfig,
  type LobstersSourceResult,
  lobstersConfigSchema,
  lobstersDataSchema,
} from "./config.js";
import { LOBSTERS_WIDGET_ID } from "./definition.js";

export type LobstersProviderDeps = {
  adapter: LobstersAdapter;
};

function sourceLabel(source: LobstersSourceConfig): string {
  const override = source.label?.trim();
  if (override) {
    return override.slice(0, 120);
  }
  if (source.kind === "tag") {
    const tag = source.tag?.trim() ?? "tag";
    return `Tag: ${tag}`.slice(0, 120);
  }
  return LOBSTERS_SOURCE_KIND_LABELS[source.kind];
}

function sanitizeStory(
  raw: LobstersStoryPayload,
  sourceId: string,
  sourceLabelText: string,
): LobstersItem | null {
  const title = stripHtmlToText(raw.title, 240);
  if (!title) {
    return null;
  }
  const commentsUrl = sanitizeHttpUrl(raw.commentsUrl);
  if (!commentsUrl) {
    return null;
  }
  const tags = raw.tags
    .map((tag) => stripHtmlToText(tag, 50))
    .filter((tag) => tag.length > 0)
    .slice(0, 20);
  return {
    id: raw.id.slice(0, 64),
    title,
    url: sanitizeHttpUrl(raw.url),
    commentsUrl,
    score: Math.max(0, Math.floor(raw.score)),
    commentCount: Math.max(0, Math.floor(raw.commentCount)),
    author: stripHtmlToText(raw.author, 80) || "unknown",
    publishedAt: parseFeedDate(raw.publishedAt),
    tags,
    sourceId,
    sourceLabel: sourceLabelText,
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

export function createLobstersProvider(deps: LobstersProviderDeps) {
  return defineWidgetProvider<LobstersConfig, LobstersData>({
    id: LOBSTERS_WIDGET_ID,
    fetch: async (ctx) => {
      const config = lobstersConfigSchema.parse(ctx.config);

      if (!config.enabled) {
        return { state: "disabled", message: "Lobsters is disabled in settings." };
      }

      if (config.sources.length === 0) {
        return {
          state: "configuration-required",
          message: "Add at least one Lobsters source in settings.",
        };
      }

      const now = ctx.now?.() ?? new Date();
      const sourceResults: LobstersSourceResult[] = [];
      const collected: LobstersItem[] = [];
      const cacheStatuses: WidgetCacheStatus[] = [];
      let failedSourceCount = 0;

      await Promise.all(
        config.sources.map(async (sourceConfig) => {
          const label = sourceLabel(sourceConfig);
          const limit = sourceConfig.itemLimit ?? config.defaultItemLimit;

          try {
            const result = await deps.adapter.fetchSource({
              kind: sourceConfig.kind,
              ...(sourceConfig.kind === "tag" && sourceConfig.tag ? { tag: sourceConfig.tag } : {}),
              limit,
              ...(ctx.signal ? { signal: ctx.signal } : {}),
              ...(ctx.forceRefresh !== undefined ? { forceRefresh: ctx.forceRefresh } : {}),
              now,
            });
            cacheStatuses.push(result.cacheStatus);

            const items: LobstersItem[] = [];
            for (const raw of result.stories) {
              const item = sanitizeStory(raw, sourceConfig.id, label);
              if (item) {
                items.push(item);
              }
              if (items.length >= limit) {
                break;
              }
            }

            collected.push(...items);
            sourceResults.push({
              id: sourceConfig.id,
              kind: sourceConfig.kind,
              ...(sourceConfig.kind === "tag" && sourceConfig.tag ? { tag: sourceConfig.tag } : {}),
              label,
              status: items.length === 0 ? "empty" : "ok",
              itemCount: items.length,
              cacheStatus: result.cacheStatus,
              ...(items.length === 0 ? { message: "This source returned no stories." } : {}),
            });
          } catch {
            failedSourceCount += 1;
            sourceResults.push({
              id: sourceConfig.id,
              kind: sourceConfig.kind,
              ...(sourceConfig.kind === "tag" && sourceConfig.tag ? { tag: sourceConfig.tag } : {}),
              label,
              status: "error",
              message: "Could not load this source.",
              itemCount: 0,
            });
          }
        }),
      );

      const orderedSources = config.sources
        .map((source) => sourceResults.find((result) => result.id === source.id))
        .filter((result): result is LobstersSourceResult => Boolean(result));

      let items = [...collected].sort((a, b) => {
        const aTime = a.publishedAt ? Date.parse(a.publishedAt) : 0;
        const bTime = b.publishedAt ? Date.parse(b.publishedAt) : 0;
        return bTime - aTime;
      });

      items = items.slice(0, config.maxItems);

      const data = lobstersDataSchema.parse({
        layout: config.layout,
        showScore: config.showScore,
        showCommentCount: config.showCommentCount,
        openInNewTab: config.openInNewTab,
        items,
        sources: orderedSources,
        fetchedAt: now.toISOString(),
        failedSourceCount,
      });

      const cacheStatus = mergeCacheStatus(cacheStatuses);

      if (items.length === 0 && failedSourceCount === config.sources.length) {
        return {
          state: "error",
          data,
          message: "All configured Lobsters sources failed to load.",
          errorCode: "lobsters_all_sources_failed",
          cacheStatus,
        };
      }

      if (items.length === 0) {
        return {
          state: "empty",
          data,
          message:
            failedSourceCount > 0
              ? "No stories to show. Some sources failed — check settings."
              : "No stories were returned by the configured sources.",
          cacheStatus,
        };
      }

      if (cacheStatus === "stale" || failedSourceCount > 0) {
        return {
          state: "stale",
          data,
          message:
            failedSourceCount > 0
              ? `Showing available stories. ${failedSourceCount} source${failedSourceCount === 1 ? "" : "s"} failed.`
              : "Showing last good Lobsters stories while a refresh is due.",
          cacheStatus: cacheStatus === "stale" ? "stale" : cacheStatus,
        };
      }

      if (ctx.forceRefresh) {
        return {
          state: "refreshing",
          data,
          message: "Refreshing Lobsters…",
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
