import type { WidgetCacheStatus } from "../../cache.js";

/** Raw event from an upstream ICS parse before widget sanitization. */
export type CalendarRawEvent = {
  uid: string;
  summary?: string;
  description?: string;
  location?: string;
  classification?: "PUBLIC" | "PRIVATE" | "CONFIDENTIAL" | "UNKNOWN";
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  allDayDate?: string;
};

export type CalendarRawFeed = {
  calendarName?: string;
  timezone?: string;
  events: CalendarRawEvent[];
};

export type CalendarBasicAuth = {
  username: string;
  password: string;
};

export type CalendarFeedFetchResult = {
  feed: CalendarRawFeed;
  cacheStatus: WidgetCacheStatus;
};

/**
 * Fetches and parses a single ICS feed URL. Failures should throw so the widget
 * provider can isolate errors per feed.
 */
export type CalendarFeedFetcher = {
  fetchFeed: (
    url: string,
    options?: {
      signal?: AbortSignal;
      forceRefresh?: boolean;
      basicAuth?: CalendarBasicAuth;
      /** Expansion window for recurring events (UTC ms). */
      rangeStartMs?: number;
      rangeEndMs?: number;
    },
  ) => Promise<CalendarFeedFetchResult>;
};
