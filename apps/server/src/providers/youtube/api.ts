import {
  FeedAdapterError,
  type YoutubeAdapter,
  type YoutubeChannelFetchRequest,
  type YoutubeChannelFetchResult,
  type YoutubeVideoPayload,
} from "@dashora/widget-sdk/widgets/youtube/server";
import { type ProviderError, isProviderError } from "../errors.js";
import type { AtomEntry, AtomFeed } from "../parsers/atom.js";
import type { ProviderPlatform } from "../platform.js";

const DEFAULT_FEED_BASE = "https://www.youtube.com";
const PROVIDER_ID = "youtube";

function mapYoutubeError(error: ProviderError): FeedAdapterError {
  const status = error.statusCode;
  if (error.code === "rate_limited" || status === 429) {
    return new FeedAdapterError(
      "rate_limited",
      "YouTube feed rate limit exceeded. Try again later.",
      { statusCode: status ?? 429, providerId: PROVIDER_ID, cause: error },
    );
  }
  if (status === 404) {
    return new FeedAdapterError("not_found", "YouTube channel feed was not found.", {
      statusCode: status,
      providerId: PROVIDER_ID,
      cause: error,
    });
  }
  if (status === 403) {
    return new FeedAdapterError(
      "forbidden",
      "YouTube blocked this feed request. The channel may be unavailable.",
      { statusCode: status, providerId: PROVIDER_ID, cause: error },
    );
  }
  return new FeedAdapterError("upstream", "Could not load videos from YouTube.", {
    ...(status !== undefined ? { statusCode: status } : {}),
    providerId: PROVIDER_ID,
    cause: error,
  });
}

function videoIdFromEntry(entry: AtomEntry): string | null {
  if (entry.id) {
    const match = entry.id.match(/:video:(.+)$/);
    if (match?.[1]) {
      return match[1];
    }
  }
  if (entry.link) {
    try {
      const url = new URL(entry.link);
      const v = url.searchParams.get("v");
      if (v) {
        return v;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

function toVideo(entry: AtomEntry, channelTitle: string): YoutubeVideoPayload | null {
  if (!entry.title?.trim()) {
    return null;
  }
  const videoId = videoIdFromEntry(entry);
  const url = entry.link?.trim() || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : null);
  if (!url) {
    return null;
  }
  const id = videoId ?? entry.id ?? url;
  const rawDate = entry.published ?? entry.updated;
  const publishedAt =
    rawDate && Number.isFinite(Date.parse(rawDate))
      ? new Date(Date.parse(rawDate)).toISOString()
      : null;
  const thumbnailUrl =
    entry.thumbnailUrl ?? (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null);

  return {
    id,
    title: entry.title.trim(),
    url,
    channelTitle,
    publishedAt,
    thumbnailUrl,
  };
}

function parseChannelFeed(text: string, platform: ProviderPlatform): AtomFeed {
  return platform.parsers.parseAtomXml(text);
}

export type YoutubeAdapterOptions = {
  platform: ProviderPlatform;
  feedBaseUrl?: string;
};

export function createYoutubeAdapter(options: YoutubeAdapterOptions): YoutubeAdapter {
  const feedBaseUrl = (options.feedBaseUrl ?? DEFAULT_FEED_BASE).replace(/\/$/, "");

  return {
    id: PROVIDER_ID,

    async fetchChannel(request: YoutubeChannelFetchRequest): Promise<YoutubeChannelFetchResult> {
      const feedUrl = `${feedBaseUrl}/feeds/videos.xml?channel_id=${encodeURIComponent(request.channelId)}`;

      try {
        const { text, result } = await options.platform.fetchText({
          providerId: PROVIDER_ID,
          url: feedUrl,
          ...(request.signal ? { signal: request.signal } : {}),
          ...(request.forceRefresh !== undefined ? { forceRefresh: request.forceRefresh } : {}),
          cachePolicy: { ttlSeconds: 300, staleWhileRevalidateSeconds: 1200 },
        });

        const feed = parseChannelFeed(text, options.platform);
        const channelTitle = feed.title?.trim() || "YouTube channel";
        const limit = Math.max(1, request.limit);

        const videos: YoutubeVideoPayload[] = [];
        for (const entry of feed.entries) {
          if (videos.length >= limit) {
            break;
          }
          const video = toVideo(entry, channelTitle);
          if (video) {
            videos.push(video);
          }
        }

        return {
          channelTitle,
          videos,
          cacheStatus: result.cacheStatus,
        };
      } catch (error) {
        if (error instanceof FeedAdapterError) {
          throw error;
        }
        if (isProviderError(error)) {
          throw mapYoutubeError(error);
        }
        throw new FeedAdapterError("upstream", "Could not load videos from YouTube.", {
          providerId: PROVIDER_ID,
          cause: error,
        });
      }
    },
  };
}
