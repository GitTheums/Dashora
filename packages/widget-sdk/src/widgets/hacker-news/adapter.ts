import type { WidgetCacheStatus } from "../../cache.js";
import { FeedAdapterError, isFeedAdapterError } from "../_shared/feed-errors.js";
import type { HackerNewsFeed } from "./config.js";

export { FeedAdapterError, isFeedAdapterError };

export type HackerNewsStoryPayload = {
  id: string;
  title: string;
  url: string | null;
  hnUrl: string;
  score: number;
  commentCount: number;
  author: string;
  publishedAt: string | null;
  domain: string | null;
};

export type HackerNewsFetchRequest = {
  feed: HackerNewsFeed;
  limit: number;
  signal?: AbortSignal;
  forceRefresh?: boolean;
  now?: Date;
};

export type HackerNewsFetchResult = {
  stories: HackerNewsStoryPayload[];
  cacheStatus: WidgetCacheStatus;
};

/**
 * Pluggable Hacker News upstream. Production uses the Firebase API; tests inject fakes.
 */
export type HackerNewsAdapter = {
  readonly id: string;
  fetchStories: (request: HackerNewsFetchRequest) => Promise<HackerNewsFetchResult>;
};
