import type { WidgetCacheStatus } from "../../cache.js";
import { defineWidgetProvider } from "../../provider.js";
import { feedAdapterErrorToWidget } from "../_shared/feed-errors.js";
import { parseFeedDate, sanitizeHttpUrl, stripHtmlToText } from "../rss/sanitize.js";
import type { YoutubeAdapter, YoutubeVideoPayload } from "./adapter.js";
import {
  type YoutubeConfig,
  type YoutubeData,
  type YoutubeItem,
  type YoutubeSourceResult,
  isYoutubeConfigured,
  youtubeConfigSchema,
  youtubeDataSchema,
} from "./config.js";
import { YOUTUBE_WIDGET_ID } from "./definition.js";

export type YoutubeProviderDeps = {
  adapter: YoutubeAdapter;
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

function itemId(sourceId: string, raw: YoutubeVideoPayload, index: number): string {
  const basis = raw.id || raw.url || raw.title || `item-${index}`;
  const cleaned = basis.replace(/\s+/g, " ").trim().slice(0, 160);
  return `${sourceId}:${cleaned}`;
}

function sanitizeVideo(
  sourceId: string,
  sourceLabel: string,
  channelTitle: string,
  raw: YoutubeVideoPayload,
  index: number,
  showThumbnails: boolean,
): YoutubeItem | null {
  const title = stripHtmlToText(raw.title, 240);
  if (!title) {
    return null;
  }
  const url = sanitizeHttpUrl(raw.url);
  if (!url) {
    return null;
  }
  const label = stripHtmlToText(sourceLabel, 80) || stripHtmlToText(channelTitle, 120) || "Channel";
  return {
    id: itemId(sourceId, raw, index),
    title,
    url,
    channelTitle: stripHtmlToText(channelTitle, 120) || label,
    publishedAt: parseFeedDate(raw.publishedAt),
    thumbnailUrl: showThumbnails ? sanitizeHttpUrl(raw.thumbnailUrl) : null,
    sourceId,
    sourceLabel: label,
  };
}

export function createYoutubeProvider(deps: YoutubeProviderDeps) {
  return defineWidgetProvider<YoutubeConfig, YoutubeData>({
    id: YOUTUBE_WIDGET_ID,
    fetch: async (ctx) => {
      const config = youtubeConfigSchema.parse(ctx.config);

      if (!config.enabled) {
        return { state: "disabled", message: "YouTube is disabled in settings." };
      }

      if (!isYoutubeConfigured(config)) {
        return {
          state: "configuration-required",
          message: "Add at least one YouTube channel ID in settings.",
        };
      }

      const now = ctx.now?.() ?? new Date();
      const sourceResults: YoutubeSourceResult[] = [];
      const collected: YoutubeItem[] = [];
      const cacheStatuses: WidgetCacheStatus[] = [];
      let failedSourceCount = 0;

      await Promise.all(
        config.channels.map(async (channelConfig) => {
          const label =
            channelConfig.label?.trim() || `Channel ${channelConfig.channelId.slice(0, 8)}…`;
          const limit = channelConfig.itemLimit ?? config.defaultItemLimit;

          try {
            const result = await deps.adapter.fetchChannel({
              channelId: channelConfig.channelId,
              limit,
              ...(ctx.signal ? { signal: ctx.signal } : {}),
              ...(ctx.forceRefresh !== undefined ? { forceRefresh: ctx.forceRefresh } : {}),
            });
            cacheStatuses.push(result.cacheStatus);

            const channelTitle =
              stripHtmlToText(result.channelTitle, 120) || channelConfig.label?.trim() || label;
            const items: YoutubeItem[] = [];
            for (let index = 0; index < result.videos.length && items.length < limit; index++) {
              const raw = result.videos[index];
              if (!raw) {
                continue;
              }
              const item = sanitizeVideo(
                channelConfig.id,
                label,
                channelTitle,
                raw,
                index,
                config.showThumbnails,
              );
              if (item) {
                items.push(item);
              }
            }

            collected.push(...items);
            sourceResults.push({
              id: channelConfig.id,
              channelId: channelConfig.channelId,
              label,
              status: items.length === 0 ? "empty" : "ok",
              itemCount: items.length,
              cacheStatus: result.cacheStatus,
              ...(items.length === 0 ? { message: "This channel returned no videos." } : {}),
            });
          } catch {
            failedSourceCount += 1;
            sourceResults.push({
              id: channelConfig.id,
              channelId: channelConfig.channelId,
              label,
              status: "error",
              message: "Could not load this channel.",
              itemCount: 0,
            });
          }
        }),
      );

      const orderedSources = config.channels
        .map((channel) => sourceResults.find((result) => result.id === channel.id))
        .filter((result): result is YoutubeSourceResult => Boolean(result));

      let items = [...collected].sort((a, b) => {
        const aTime = a.publishedAt ? Date.parse(a.publishedAt) : 0;
        const bTime = b.publishedAt ? Date.parse(b.publishedAt) : 0;
        return bTime - aTime;
      });

      items = items.slice(0, config.maxItems);

      const data = youtubeDataSchema.parse({
        layout: config.layout,
        showThumbnails: config.showThumbnails,
        openInNewTab: config.openInNewTab,
        items,
        sources: orderedSources,
        fetchedAt: now.toISOString(),
        failedSourceCount,
      });

      const cacheStatus = mergeCacheStatus(cacheStatuses);

      if (items.length === 0 && failedSourceCount === config.channels.length) {
        return {
          state: "error",
          data,
          message: "All configured channels failed to load.",
          errorCode: "youtube_all_channels_failed",
          cacheStatus,
        };
      }

      if (items.length === 0) {
        return {
          state: "empty",
          data,
          message:
            failedSourceCount > 0
              ? "No videos to show. Some channels failed — check settings."
              : "No videos were returned by the configured channels.",
          cacheStatus,
        };
      }

      if (cacheStatus === "stale" || failedSourceCount > 0) {
        return {
          state: "stale",
          data,
          message:
            failedSourceCount > 0
              ? `Showing available videos. ${failedSourceCount} channel${failedSourceCount === 1 ? "" : "s"} failed.`
              : "Showing last good uploads while a refresh is due.",
          cacheStatus: cacheStatus === "stale" ? "stale" : cacheStatus,
        };
      }

      if (ctx.forceRefresh) {
        return {
          state: "refreshing",
          data,
          message: "Refreshing YouTube uploads…",
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
