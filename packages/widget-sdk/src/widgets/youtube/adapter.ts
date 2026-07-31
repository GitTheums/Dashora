import type { WidgetCacheStatus } from "../../cache.js";
import { FeedAdapterError, isFeedAdapterError } from "../_shared/feed-errors.js";

export { FeedAdapterError, isFeedAdapterError };

export type YoutubeVideoPayload = {
  id: string;
  title: string;
  url: string;
  channelTitle: string;
  publishedAt: string | null;
  thumbnailUrl: string | null;
};

export type YoutubeChannelFetchRequest = {
  channelId: string;
  limit: number;
  signal?: AbortSignal;
  forceRefresh?: boolean;
};

export type YoutubeChannelFetchResult = {
  channelTitle: string;
  videos: YoutubeVideoPayload[];
  cacheStatus: WidgetCacheStatus;
};

/**
 * Pluggable YouTube Atom feed upstream. Production uses the official channel feed; tests inject fakes.
 */
export type YoutubeAdapter = {
  readonly id: string;
  fetchChannel: (request: YoutubeChannelFetchRequest) => Promise<YoutubeChannelFetchResult>;
};
