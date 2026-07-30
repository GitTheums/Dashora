import type { WidgetCacheStatus } from "../../cache.js";
import { defineWidgetProvider } from "../../provider.js";
import {
  type CalendarConfig,
  type CalendarData,
  type CalendarDaySummary,
  type CalendarEvent,
  type CalendarFeedResult,
  calendarConfigSchema,
  calendarDataSchema,
} from "./config.js";
import { CALENDAR_WIDGET_ID } from "./definition.js";
import type { CalendarFeedFetcher, CalendarRawEvent } from "./fetcher.js";
import {
  addDaysToDateKey,
  dateKeyInTimeZone,
  isPrivateClassification,
  parseBasicAuthSecret,
  redactEventFields,
  startOfDayInTimeZone,
  stripControlChars,
} from "./sanitize.js";

export type CalendarProviderDeps = {
  fetcher: CalendarFeedFetcher;
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

function eventId(feedId: string, raw: CalendarRawEvent, index: number): string {
  const basis = `${raw.uid}:${raw.startsAt}:${index}`;
  return `${feedId}:${basis}`.slice(0, 240);
}

function eventDateKeys(event: CalendarEvent, timeZone: string): string[] {
  if (event.allDay && event.allDayDate) {
    const keys: string[] = [];
    // Exclusive end: walk all-day dates until endsAt date key (UTC date of endsAt)
    const endKey = event.endsAt.slice(0, 10);
    let cursor = event.allDayDate;
    for (let guard = 0; guard < 93; guard++) {
      if (cursor >= endKey) {
        break;
      }
      keys.push(cursor);
      cursor = addDaysToDateKey(cursor, 1);
    }
    return keys.length > 0 ? keys : [event.allDayDate];
  }
  const startKey = dateKeyInTimeZone(new Date(event.startsAt), timeZone);
  const endInstant = new Date(event.endsAt);
  // Exclusive end: if ends exactly at midnight, last day is previous
  const endMs = endInstant.getTime();
  const inclusiveEnd = endMs > Date.parse(event.startsAt) ? new Date(endMs - 1) : endInstant;
  const endKey = dateKeyInTimeZone(inclusiveEnd, timeZone);
  if (startKey === endKey) {
    return [startKey];
  }
  const keys: string[] = [];
  let cursor = startKey;
  for (let guard = 0; guard < 93; guard++) {
    keys.push(cursor);
    if (cursor >= endKey) {
      break;
    }
    cursor = addDaysToDateKey(cursor, 1);
  }
  return keys;
}

function sanitizeEvent(
  feedId: string,
  feedTitle: string,
  color: CalendarEvent["color"],
  raw: CalendarRawEvent,
  index: number,
  config: CalendarConfig,
): CalendarEvent | null {
  const isPrivate = isPrivateClassification(raw.classification);
  const redacted = redactEventFields({
    title: raw.summary ?? "",
    description: raw.description ?? "",
    location: raw.location ?? "",
    isPrivate,
    redactPrivateDetails: config.redactPrivateDetails,
    hideDescriptions: config.hideDescriptions,
  });

  const startsAt = Date.parse(raw.startsAt);
  const endsAt = Date.parse(raw.endsAt);
  if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) {
    return null;
  }

  return {
    id: eventId(feedId, raw, index),
    title: redacted.title,
    description: redacted.description,
    location: redacted.location,
    startsAt: new Date(startsAt).toISOString(),
    endsAt: new Date(endsAt).toISOString(),
    allDay: Boolean(raw.allDay),
    ...(raw.allDay && raw.allDayDate ? { allDayDate: raw.allDayDate } : {}),
    isPrivate,
    feedId,
    feedTitle,
    color,
  };
}

function buildDaySummaries(
  events: CalendarEvent[],
  today: string,
  lookAheadDays: number,
  timeZone: string,
): CalendarDaySummary[] {
  const endKey = addDaysToDateKey(today, lookAheadDays);
  const counts = new Map<string, number>();
  for (const event of events) {
    for (const key of eventDateKeys(event, timeZone)) {
      if (key < today || key >= endKey) {
        continue;
      }
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const summaries: CalendarDaySummary[] = [];
  let cursor = today;
  for (let i = 0; i < lookAheadDays; i++) {
    summaries.push({
      date: cursor,
      eventCount: counts.get(cursor) ?? 0,
      isToday: cursor === today,
    });
    cursor = addDaysToDateKey(cursor, 1);
  }
  return summaries;
}

function filterEventsForLayout(
  events: CalendarEvent[],
  config: CalendarConfig,
  today: string,
  timeZone: string,
): CalendarEvent[] {
  if (config.layout === "day") {
    return events.filter((event) => eventDateKeys(event, timeZone).includes(today));
  }
  return events;
}

export function createCalendarProvider(deps: CalendarProviderDeps) {
  return defineWidgetProvider<CalendarConfig, CalendarData>({
    id: CALENDAR_WIDGET_ID,
    fetch: async (ctx) => {
      const config = calendarConfigSchema.parse(ctx.config);

      if (!config.enabled) {
        return { state: "disabled", message: "Calendar is disabled in settings." };
      }

      if (config.feeds.length === 0) {
        return {
          state: "configuration-required",
          message: "Add at least one ICS feed URL in settings.",
        };
      }

      const now = ctx.now?.() ?? new Date();
      const today = dateKeyInTimeZone(now, config.timezone);
      const rangeStartMs = startOfDayInTimeZone(today, config.timezone);
      const rangeEndKey = addDaysToDateKey(today, config.lookAheadDays);
      const rangeEndMs = startOfDayInTimeZone(rangeEndKey, config.timezone);

      const feedResults: CalendarFeedResult[] = [];
      const collected: CalendarEvent[] = [];
      const cacheStatuses: WidgetCacheStatus[] = [];
      let failedFeedCount = 0;

      await Promise.all(
        config.feeds.map(async (feedConfig) => {
          const override = feedConfig.titleOverride.trim();
          const fallbackTitle = override || "Calendar";
          const hasCredential = Boolean(feedConfig.credentialId);

          try {
            let basicAuth: { username: string; password: string } | undefined;
            if (feedConfig.credentialId && ctx.getSecret) {
              const secret = await ctx.getSecret(feedConfig.credentialId);
              const parsed = parseBasicAuthSecret(secret);
              if (parsed) {
                basicAuth = parsed;
              }
            }

            const result = await deps.fetcher.fetchFeed(feedConfig.url, {
              ...(ctx.signal ? { signal: ctx.signal } : {}),
              ...(ctx.forceRefresh !== undefined ? { forceRefresh: ctx.forceRefresh } : {}),
              ...(basicAuth ? { basicAuth } : {}),
              rangeStartMs,
              rangeEndMs,
            });
            cacheStatuses.push(result.cacheStatus);

            const feedTitle =
              override || stripControlChars(result.feed.calendarName ?? "", 120) || fallbackTitle;

            const events: CalendarEvent[] = [];
            for (let index = 0; index < result.feed.events.length; index++) {
              const raw = result.feed.events[index];
              if (!raw) {
                continue;
              }
              const event = sanitizeEvent(
                feedConfig.id,
                feedTitle,
                feedConfig.color,
                raw,
                index,
                config,
              );
              if (event) {
                events.push(event);
              }
            }

            collected.push(...events);
            feedResults.push({
              id: feedConfig.id,
              url: feedConfig.url,
              title: feedTitle,
              color: feedConfig.color,
              status: events.length === 0 ? "empty" : "ok",
              eventCount: events.length,
              cacheStatus: result.cacheStatus,
              hasCredential,
              ...(events.length === 0 ? { message: "This feed returned no events in range." } : {}),
            });
          } catch {
            failedFeedCount += 1;
            feedResults.push({
              id: feedConfig.id,
              url: feedConfig.url,
              title: fallbackTitle,
              color: feedConfig.color,
              status: "error",
              message: "Could not load this calendar feed.",
              eventCount: 0,
              hasCredential,
            });
          }
        }),
      );

      const orderedFeeds = config.feeds
        .map((feed) => feedResults.find((result) => result.id === feed.id))
        .filter((result): result is CalendarFeedResult => Boolean(result));

      let events = [...collected].sort((a, b) => {
        const byStart = a.startsAt.localeCompare(b.startsAt);
        if (byStart !== 0) {
          return byStart;
        }
        return a.title.localeCompare(b.title);
      });

      // Keep events overlapping the look-ahead window
      events = events.filter((event) => {
        const keys = eventDateKeys(event, config.timezone);
        return keys.some((key) => key >= today && key < rangeEndKey);
      });

      const daySummaries = buildDaySummaries(events, today, config.lookAheadDays, config.timezone);

      events = filterEventsForLayout(events, config, today, config.timezone);
      events = events.slice(0, config.maxEvents);

      const data = calendarDataSchema.parse({
        layout: config.layout,
        timezone: config.timezone,
        today,
        lookAheadDays: config.lookAheadDays,
        hideDescriptions: config.hideDescriptions,
        redactPrivateDetails: config.redactPrivateDetails,
        events,
        daySummaries,
        feeds: orderedFeeds,
        fetchedAt: now.toISOString(),
        failedFeedCount,
      });

      const cacheStatus = mergeCacheStatus(cacheStatuses);

      if (events.length === 0 && failedFeedCount === config.feeds.length) {
        return {
          state: "error",
          data,
          message: "All configured calendar feeds failed to load.",
          errorCode: "calendar_all_feeds_failed",
          cacheStatus,
        };
      }

      if (events.length === 0) {
        return {
          state: "empty",
          data,
          message:
            failedFeedCount > 0
              ? "No events to show. Some feeds failed — check settings."
              : "No upcoming events in the configured look-ahead period.",
          cacheStatus,
        };
      }

      if (cacheStatus === "stale" || failedFeedCount > 0) {
        return {
          state: "stale",
          data,
          message:
            failedFeedCount > 0
              ? `Showing available events. ${failedFeedCount} feed${failedFeedCount === 1 ? "" : "s"} failed.`
              : "Showing last good calendar data while a refresh is due.",
          cacheStatus: cacheStatus === "stale" ? "stale" : cacheStatus,
        };
      }

      if (ctx.forceRefresh) {
        return {
          state: "refreshing",
          data,
          message: "Refreshing calendars…",
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
