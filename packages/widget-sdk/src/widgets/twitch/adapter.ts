import type { WidgetCacheStatus } from "../../cache.js";
import { FeedAdapterError, isFeedAdapterError } from "../_shared/feed-errors.js";

export { FeedAdapterError, isFeedAdapterError };

export type TwitchCredentials = {
  clientId: string;
  clientSecret: string;
};

export type TwitchChannelPayload = {
  id: string;
  login: string;
  displayName: string;
  title: string | null;
  gameName: string | null;
  viewerCount: number;
  startedAt: string | null;
  url: string;
  thumbnailUrl: string | null;
  isLive: boolean;
};

export type TwitchChannelsFetchRequest = {
  logins: string[];
  credentials: TwitchCredentials;
  signal?: AbortSignal;
  forceRefresh?: boolean;
};

export type TwitchChannelsFetchResult = {
  channels: TwitchChannelPayload[];
  cacheStatus: WidgetCacheStatus;
};

/**
 * Pluggable Twitch Helix upstream. Production uses the official API; tests inject fakes.
 */
export type TwitchAdapter = {
  readonly id: string;
  isConfigured: (credentials: TwitchCredentials | null) => boolean;
  fetchChannels: (request: TwitchChannelsFetchRequest) => Promise<TwitchChannelsFetchResult>;
};
