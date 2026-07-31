import {
  FeedAdapterError,
  type HackerNewsAdapter,
  type HackerNewsFeed,
  type HackerNewsFetchRequest,
  type HackerNewsFetchResult,
  type HackerNewsStoryPayload,
} from "@dashora/widget-sdk/widgets/hacker-news/server";
import { type ProviderError, isProviderError } from "../errors.js";
import type { ProviderPlatform } from "../platform.js";

const HN_API_BASE = "https://hacker-news.firebaseio.com/v0";
const PROVIDER_ID = "hacker-news";

const FEED_PATH: Record<HackerNewsFeed, string> = {
  top: "topstories",
  new: "newstories",
  best: "beststories",
  ask: "askstories",
  show: "showstories",
  jobs: "jobstories",
};

type HnItemJson = {
  id?: number;
  deleted?: boolean;
  type?: string;
  by?: string;
  time?: number;
  text?: string;
  dead?: boolean;
  url?: string;
  score?: number;
  title?: string;
  descendants?: number;
};

function mapHnError(error: ProviderError): FeedAdapterError {
  const status = error.statusCode;
  if (error.code === "rate_limited" || status === 429) {
    return new FeedAdapterError(
      "rate_limited",
      "Hacker News API rate limit exceeded. Try again later.",
      { statusCode: status ?? 429, providerId: PROVIDER_ID, cause: error },
    );
  }
  if (status === 401 || status === 403) {
    return new FeedAdapterError(
      "forbidden",
      "Hacker News blocked this request. The Firebase API may have changed access rules.",
      { statusCode: status, providerId: PROVIDER_ID, cause: error },
    );
  }
  return new FeedAdapterError("upstream", "Could not load stories from Hacker News.", {
    ...(status !== undefined ? { statusCode: status } : {}),
    providerId: PROVIDER_ID,
    cause: error,
  });
}

function domainFromUrl(url: string | null): string | null {
  if (!url) {
    return null;
  }
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return null;
  }
}

function toStory(item: HnItemJson): HackerNewsStoryPayload | null {
  if (!item.id || item.deleted || item.dead || !item.title) {
    return null;
  }
  const id = String(item.id);
  const url = typeof item.url === "string" && item.url.trim() ? item.url.trim() : null;
  return {
    id,
    title: item.title,
    url,
    hnUrl: `https://news.ycombinator.com/item?id=${id}`,
    score: typeof item.score === "number" && Number.isFinite(item.score) ? item.score : 0,
    commentCount:
      typeof item.descendants === "number" && Number.isFinite(item.descendants)
        ? item.descendants
        : 0,
    author: typeof item.by === "string" && item.by.trim() ? item.by.trim() : "unknown",
    publishedAt:
      typeof item.time === "number" && Number.isFinite(item.time)
        ? new Date(item.time * 1000).toISOString()
        : null,
    domain: domainFromUrl(url),
  };
}

export type HackerNewsAdapterOptions = {
  platform: ProviderPlatform;
  baseUrl?: string;
};

export function createHackerNewsAdapter(options: HackerNewsAdapterOptions): HackerNewsAdapter {
  const baseUrl = (options.baseUrl ?? HN_API_BASE).replace(/\/$/, "");

  return {
    id: PROVIDER_ID,

    async fetchStories(request: HackerNewsFetchRequest): Promise<HackerNewsFetchResult> {
      const feedPath = FEED_PATH[request.feed];
      const listUrl = `${baseUrl}/${feedPath}.json`;

      try {
        const { data: listJson, result: listResult } = await options.platform.fetchJson({
          providerId: PROVIDER_ID,
          url: listUrl,
          ...(request.signal ? { signal: request.signal } : {}),
          ...(request.forceRefresh !== undefined ? { forceRefresh: request.forceRefresh } : {}),
          cachePolicy: { ttlSeconds: 120, staleWhileRevalidateSeconds: 600 },
        });

        if (!Array.isArray(listJson)) {
          throw new FeedAdapterError(
            "upstream",
            "Hacker News returned an unexpected story list. The API may have changed.",
            { providerId: PROVIDER_ID },
          );
        }

        const ids = listJson
          .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
          .slice(0, Math.max(1, request.limit));

        const stories: HackerNewsStoryPayload[] = [];
        let worstCache = listResult.cacheStatus;

        // Fetch items sequentially in small batches to respect rate limits while staying snappy.
        const concurrency = 6;
        for (let offset = 0; offset < ids.length; offset += concurrency) {
          const batch = ids.slice(offset, offset + concurrency);
          const batchResults = await Promise.all(
            batch.map(async (id) => {
              const { data: itemJson, result: itemResult } = await options.platform.fetchJson({
                providerId: PROVIDER_ID,
                url: `${baseUrl}/item/${id}.json`,
                ...(request.signal ? { signal: request.signal } : {}),
                ...(request.forceRefresh !== undefined
                  ? { forceRefresh: request.forceRefresh }
                  : {}),
                cachePolicy: { ttlSeconds: 300, staleWhileRevalidateSeconds: 1200 },
              });
              if (itemResult.cacheStatus === "stale") {
                worstCache = "stale";
              } else if (worstCache === "hit" && itemResult.cacheStatus !== "hit") {
                worstCache = itemResult.cacheStatus;
              }
              return itemJson as HnItemJson | null;
            }),
          );
          for (const item of batchResults) {
            if (!item) {
              continue;
            }
            const story = toStory(item);
            if (story) {
              stories.push(story);
            }
          }
        }

        return { stories, cacheStatus: worstCache };
      } catch (error) {
        if (error instanceof FeedAdapterError) {
          throw error;
        }
        if (isProviderError(error)) {
          throw mapHnError(error);
        }
        throw new FeedAdapterError("upstream", "Could not load stories from Hacker News.", {
          providerId: PROVIDER_ID,
          cause: error,
        });
      }
    },
  };
}
