import type { WidgetCacheStatus } from "../../cache.js";
import { FeedAdapterError, isFeedAdapterError } from "../_shared/feed-errors.js";
import type { LobstersSourceKind } from "./config.js";

export { FeedAdapterError, isFeedAdapterError };

export type LobstersStoryPayload = {
  id: string;
  title: string;
  url: string | null;
  commentsUrl: string;
  score: number;
  commentCount: number;
  author: string;
  publishedAt: string | null;
  tags: string[];
};

export type LobstersSourceRequest = {
  kind: LobstersSourceKind;
  tag?: string;
  limit: number;
  signal?: AbortSignal;
  forceRefresh?: boolean;
  now?: Date;
};

export type LobstersFetchSourceResult = {
  stories: LobstersStoryPayload[];
  cacheStatus: WidgetCacheStatus;
};

/**
 * Pluggable Lobsters upstream. Production uses lobste.rs JSON feeds; tests inject fakes.
 */
export type LobstersAdapter = {
  readonly id: string;
  fetchSource: (request: LobstersSourceRequest) => Promise<LobstersFetchSourceResult>;
};
