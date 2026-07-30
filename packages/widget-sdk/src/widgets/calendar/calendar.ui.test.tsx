import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import { CALENDAR_DEFAULT_CONFIG, type CalendarData } from "./config.js";
import { CalendarRenderer } from "./renderer.js";
import { CalendarSettings } from "./settings.js";

const sampleData: CalendarData = {
  layout: "agenda",
  timezone: "UTC",
  today: "2026-07-30",
  lookAheadDays: 14,
  hideDescriptions: false,
  redactPrivateDetails: true,
  failedFeedCount: 0,
  fetchedAt: "2026-07-30T12:00:00.000Z",
  daySummaries: [
    { date: "2026-07-30", eventCount: 1, isToday: true },
    { date: "2026-07-31", eventCount: 0, isToday: false },
  ],
  feeds: [
    {
      id: "11111111-1111-4111-8111-111111111111",
      url: "https://example.test/cal.ics",
      title: "Work",
      color: "primary",
      status: "ok",
      eventCount: 1,
      cacheStatus: "miss",
      hasCredential: false,
    },
  ],
  events: [
    {
      id: "1",
      title: "Planning",
      description: "Quarterly planning",
      location: "Room A",
      startsAt: "2026-07-30T10:00:00.000Z",
      endsAt: "2026-07-30T11:00:00.000Z",
      allDay: false,
      isPrivate: false,
      feedId: "11111111-1111-4111-8111-111111111111",
      feedTitle: "Work",
      color: "primary",
    },
  ],
};

afterEach(() => {
  cleanup();
});

describe("CalendarRenderer", () => {
  it.each(REQUIRED_WIDGET_STATES)("renders state=%s", (state) => {
    render(
      <CalendarRenderer
        instanceId="1"
        title="Calendar"
        config={{
          ...CALENDAR_DEFAULT_CONFIG,
          feeds: [
            {
              id: "11111111-1111-4111-8111-111111111111",
              url: "https://example.test/cal.ics",
              titleOverride: "",
              color: "primary",
              credentialId: null,
            },
          ],
        }}
        state={state}
        {...(state === "success" || state === "empty" || state === "stale" || state === "refreshing"
          ? { data: sampleData }
          : {})}
        message={`msg-${state}`}
      />,
    );
    expect(document.querySelector(`[data-widget="calendar"][data-state="${state}"]`)).toBeTruthy();
  });

  it("renders agenda events", () => {
    render(
      <CalendarRenderer
        instanceId="1"
        title="Calendar"
        config={CALENDAR_DEFAULT_CONFIG}
        state="success"
        data={sampleData}
      />,
    );
    expect(screen.getByText("Planning")).toBeTruthy();
    expect(screen.getByText("Quarterly planning")).toBeTruthy();
  });

  it("highlights today in month-summary", () => {
    render(
      <CalendarRenderer
        instanceId="1"
        title="Calendar"
        config={{ ...CALENDAR_DEFAULT_CONFIG, layout: "month-summary" }}
        state="success"
        data={{ ...sampleData, layout: "month-summary" }}
      />,
    );
    expect(document.querySelector('[aria-current="date"]')).toBeTruthy();
  });
});

describe("CalendarSettings", () => {
  it("renders feed and privacy controls", () => {
    render(
      <CalendarSettings
        instanceId="1"
        config={CALENDAR_DEFAULT_CONFIG}
        onChange={() => undefined}
        integrationsClient={{
          list: async () => ({ integrations: [] }),
          create: async () => {
            throw new Error("unused");
          },
          update: async () => {
            throw new Error("unused");
          },
          remove: async () => undefined,
        }}
      />,
    );
    expect(screen.getByLabelText("Calendar settings")).toBeTruthy();
    expect(screen.getByLabelText("Hide event descriptions")).toBeTruthy();
    expect(screen.getByLabelText("Redact private event details")).toBeTruthy();
  });
});
