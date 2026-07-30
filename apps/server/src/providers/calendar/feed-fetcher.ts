import type {
  CalendarFeedFetchResult,
  CalendarFeedFetcher,
  CalendarRawEvent,
} from "@dashora/widget-sdk/widgets/calendar/server";
import { ProviderError } from "../errors.js";
import { IcsParseError, type ParsedIcsEvent, parseIcs } from "../parsers/ics.js";
import type { ProviderPlatform } from "../platform.js";

function toRawEvent(event: ParsedIcsEvent): CalendarRawEvent {
  return {
    uid: event.uid,
    ...(event.summary !== undefined ? { summary: event.summary } : {}),
    ...(event.description !== undefined ? { description: event.description } : {}),
    ...(event.location !== undefined ? { location: event.location } : {}),
    classification: event.classification,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    allDay: event.allDay,
    ...(event.allDayDate !== undefined ? { allDayDate: event.allDayDate } : {}),
  };
}

function basicAuthHeader(username: string, password: string): string {
  const token = Buffer.from(`${username}:${password}`, "utf8").toString("base64");
  return `Basic ${token}`;
}

export function createPlatformIcsFeedFetcher(platform: ProviderPlatform): CalendarFeedFetcher {
  return {
    async fetchFeed(url, options = {}) {
      const headers: Record<string, string> = {
        Accept: "text/calendar, text/plain, */*",
      };
      if (options.basicAuth) {
        headers["Authorization"] = basicAuthHeader(
          options.basicAuth.username,
          options.basicAuth.password,
        );
      }

      const { text, result } = await platform.fetchText({
        providerId: "calendar-ics",
        url,
        headers,
        ...(options.signal ? { signal: options.signal } : {}),
        ...(options.forceRefresh !== undefined ? { forceRefresh: options.forceRefresh } : {}),
        cachePolicy: { ttlSeconds: 300, staleWhileRevalidateSeconds: 1200 },
      });

      try {
        const parsed = parseIcs(text, {
          ...(options.rangeStartMs !== undefined ? { rangeStartMs: options.rangeStartMs } : {}),
          ...(options.rangeEndMs !== undefined ? { rangeEndMs: options.rangeEndMs } : {}),
        });
        const feed: CalendarFeedFetchResult["feed"] = {
          events: parsed.events.map(toRawEvent),
          ...(parsed.calendarName ? { calendarName: parsed.calendarName } : {}),
          ...(parsed.timezone ? { timezone: parsed.timezone } : {}),
        };
        return {
          feed,
          cacheStatus: result.cacheStatus,
        };
      } catch (error) {
        if (error instanceof ProviderError) {
          throw error;
        }
        throw new ProviderError("parse_error", {
          message:
            error instanceof IcsParseError
              ? error.message
              : "Upstream calendar response could not be parsed as ICS.",
          cause: error,
        });
      }
    },
  };
}
