import type { WidgetCacheStatus } from "../../cache.js";
import { FeedAdapterError, isFeedAdapterError } from "../_shared/feed-errors.js";
import type { RedditSort, RedditTimeFrame } from "./config.js";

export { FeedAdapterError, isFeedAdapterError };

export type RedditCredentials = {
  clientId: string;
  clientSecret: string;
};

export type RedditPostPayload = {
  id: string;
  title: string;
  url: string | null;
  permalinkUrl: string;
  score: number;
  commentCount: number;
  author: string;
  subreddit: string;
  publishedAt: string | null;
  thumbnailUrl: string | null;
};

export type RedditSubredditFetchRequest = {
  name: string;
  sort: RedditSort;
  timeFrame?: RedditTimeFrame;
  limit: number;
  credentials: RedditCredentials;
  signal?: AbortSignal;
  forceRefresh?: boolean;
  now?: Date;
};

export type RedditSubredditFetchResult = {
  posts: RedditPostPayload[];
  cacheStatus: WidgetCacheStatus;
};

/**
 * Pluggable Reddit upstream. Production uses the OAuth API; tests inject fakes.
 */
export type RedditAdapter = {
  readonly id: string;
  isConfigured: (credentials: RedditCredentials | null) => boolean;
  fetchSubreddit: (request: RedditSubredditFetchRequest) => Promise<RedditSubredditFetchResult>;
};
