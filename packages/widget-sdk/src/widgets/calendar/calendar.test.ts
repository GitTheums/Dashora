import { describe, expect, it, vi } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import {
  CALENDAR_DEFAULT_CONFIG,
  type CalendarFeedConfig,
  calendarConfigSchema,
  newCalendarFeedId,
} from "./config.js";
import { calendarDefinition } from "./definition.js";
import type { CalendarFeedFetcher } from "./fetcher.js";
import { createCalendarProvider } from "./provider.js";
import {
  encodeBasicAuthSecret,
  isPrivateClassification,
  parseBasicAuthSecret,
  redactEventFields,
} from "./sanitize.js";

const feedA: CalendarFeedConfig = {
  id: "11111111-1111-4111-8111-111111111111",
  url: "https://example.test/a.ics",
  titleOverride: "Work",
  color: "primary",
  credentialId: null,
};

const feedB: CalendarFeedConfig = {
  id: "22222222-2222-4222-8222-222222222222",
  url: "https://example.test/b.ics",
  titleOverride: "",
  color: "success",
  credentialId: null,
};

function createFetcher(overrides: Partial<CalendarFeedFetcher> = {}): CalendarFeedFetcher {
  return {
    fetchFeed: vi.fn(async (url: string) => ({
      feed: {
        calendarName: url.includes("b.ics") ? "Personal" : "Work Cal",
        events: [
          {
            uid: `evt-${url}`,
            summary: `Event from ${url}`,
            description: "Details here",
            startsAt: "2026-07-30T10:00:00.000Z",
            endsAt: "2026-07-30T11:00:00.000Z",
            allDay: false,
            classification: "PUBLIC" as const,
          },
          {
            uid: `private-${url}`,
            summary: "Secret",
            description: "Hidden",
            location: "Home",
            startsAt: "2026-07-31T18:00:00.000Z",
            endsAt: "2026-07-31T19:00:00.000Z",
            allDay: false,
            classification: "PRIVATE" as const,
          },
        ],
      },
      cacheStatus: "miss" as const,
    })),
    ...overrides,
  };
}

describe("calendar definition", () => {
  it("covers every required runtime state", () => {
    expect(calendarDefinition.states).toEqual(REQUIRED_WIDGET_STATES);
    expect(calendarDefinition.id).toBe("calendar");
  });

  it("parses default config", () => {
    expect(calendarConfigSchema.parse({})).toEqual(CALENDAR_DEFAULT_CONFIG);
  });

  it("rejects credentialed feed URLs", () => {
    expect(() =>
      calendarConfigSchema.parse({
        feeds: [
          {
            id: newCalendarFeedId(),
            url: "https://user:pass@example.test/cal.ics",
          },
        ],
      }),
    ).toThrow();
  });
});

describe("calendar sanitization", () => {
  it("round-trips basic auth secrets", () => {
    const encoded = encodeBasicAuthSecret("alice", "s3cret");
    expect(parseBasicAuthSecret(encoded)).toEqual({ username: "alice", password: "s3cret" });
    expect(parseBasicAuthSecret("Bearer token")).toBeNull();
  });

  it("detects private classifications", () => {
    expect(isPrivateClassification("PRIVATE")).toBe(true);
    expect(isPrivateClassification("CONFIDENTIAL")).toBe(true);
    expect(isPrivateClassification("PUBLIC")).toBe(false);
  });

  it("redacts private details and can hide descriptions", () => {
    expect(
      redactEventFields({
        title: "Secret dinner",
        description: "Do not share",
        location: "Home",
        isPrivate: true,
        redactPrivateDetails: true,
        hideDescriptions: false,
      }),
    ).toEqual({ title: "Private event", description: "", location: "" });

    expect(
      redactEventFields({
        title: "Public",
        description: "Shown",
        location: "",
        isPrivate: false,
        redactPrivateDetails: true,
        hideDescriptions: true,
      }).description,
    ).toBe("");
  });
});

describe("calendar provider", () => {
  it("returns configuration-required without feeds", async () => {
    const provider = createCalendarProvider({ fetcher: createFetcher() });
    const result = await provider.fetch({
      instanceId: "c1",
      config: CALENDAR_DEFAULT_CONFIG,
    });
    expect(result.state).toBe("configuration-required");
  });

  it("returns disabled when enabled is false", async () => {
    const provider = createCalendarProvider({ fetcher: createFetcher() });
    const result = await provider.fetch({
      instanceId: "c1",
      config: { ...CALENDAR_DEFAULT_CONFIG, enabled: false, feeds: [feedA] },
    });
    expect(result.state).toBe("disabled");
  });

  it("aggregates events and redacts private details", async () => {
    const provider = createCalendarProvider({ fetcher: createFetcher() });
    const result = await provider.fetch({
      instanceId: "c1",
      config: {
        ...CALENDAR_DEFAULT_CONFIG,
        feeds: [feedA, feedB],
        timezone: "UTC",
        lookAheadDays: 14,
        redactPrivateDetails: true,
      },
      now: () => new Date("2026-07-30T08:00:00.000Z"),
    });
    expect(result.state).toBe("success");
    expect(result.data?.events.length).toBeGreaterThan(0);
    const privateEvent = result.data?.events.find((event) => event.isPrivate);
    expect(privateEvent?.title).toBe("Private event");
    expect(privateEvent?.description).toBe("");
    expect(privateEvent?.location).toBe("");
  });

  it("isolates feed failures as stale when others succeed", async () => {
    const fetcher = createFetcher({
      fetchFeed: vi.fn(async (url: string) => {
        if (url.includes("b.ics")) {
          throw new Error("boom");
        }
        return {
          feed: {
            calendarName: "Work Cal",
            events: [
              {
                uid: "ok",
                summary: "Still here",
                startsAt: "2026-07-30T12:00:00.000Z",
                endsAt: "2026-07-30T13:00:00.000Z",
                allDay: false,
              },
            ],
          },
          cacheStatus: "miss" as const,
        };
      }),
    });
    const provider = createCalendarProvider({ fetcher });
    const result = await provider.fetch({
      instanceId: "c1",
      config: {
        ...CALENDAR_DEFAULT_CONFIG,
        feeds: [feedA, feedB],
        timezone: "UTC",
        lookAheadDays: 7,
      },
      now: () => new Date("2026-07-30T08:00:00.000Z"),
    });
    expect(result.state).toBe("stale");
    expect(result.data?.failedFeedCount).toBe(1);
    expect(result.data?.events).toHaveLength(1);
  });

  it("returns error when all feeds fail", async () => {
    const provider = createCalendarProvider({
      fetcher: {
        fetchFeed: vi.fn(async () => {
          throw new Error("down");
        }),
      },
    });
    const result = await provider.fetch({
      instanceId: "c1",
      config: { ...CALENDAR_DEFAULT_CONFIG, feeds: [feedA] },
      now: () => new Date("2026-07-30T08:00:00.000Z"),
    });
    expect(result.state).toBe("error");
    expect(result.errorCode).toBe("calendar_all_feeds_failed");
  });

  it("passes basic auth from getSecret to the fetcher", async () => {
    const fetchFeed = vi.fn(async () => ({
      feed: { events: [] },
      cacheStatus: "miss" as const,
    }));
    const credentialId = "33333333-3333-4333-8333-333333333333";
    const provider = createCalendarProvider({ fetcher: { fetchFeed } });
    await provider.fetch({
      instanceId: "c1",
      config: {
        ...CALENDAR_DEFAULT_CONFIG,
        feeds: [{ ...feedA, credentialId }],
        timezone: "UTC",
      },
      now: () => new Date("2026-07-30T08:00:00.000Z"),
      getSecret: async () => encodeBasicAuthSecret("bob", "pw"),
    });
    expect(fetchFeed).toHaveBeenCalledWith(
      feedA.url,
      expect.objectContaining({
        basicAuth: { username: "bob", password: "pw" },
      }),
    );
  });

  it("filters day layout to today only", async () => {
    const provider = createCalendarProvider({
      fetcher: {
        fetchFeed: vi.fn(async () => ({
          feed: {
            events: [
              {
                uid: "today",
                summary: "Today",
                startsAt: "2026-07-30T10:00:00.000Z",
                endsAt: "2026-07-30T11:00:00.000Z",
                allDay: false,
              },
              {
                uid: "tomorrow",
                summary: "Tomorrow",
                startsAt: "2026-07-31T10:00:00.000Z",
                endsAt: "2026-07-31T11:00:00.000Z",
                allDay: false,
              },
            ],
          },
          cacheStatus: "hit" as const,
        })),
      },
    });
    const result = await provider.fetch({
      instanceId: "c1",
      config: {
        ...CALENDAR_DEFAULT_CONFIG,
        feeds: [feedA],
        layout: "day",
        timezone: "UTC",
        lookAheadDays: 7,
      },
      now: () => new Date("2026-07-30T08:00:00.000Z"),
    });
    expect(result.data?.events.map((event) => event.title)).toEqual(["Today"]);
    expect(result.data?.daySummaries[0]?.isToday).toBe(true);
  });
});
