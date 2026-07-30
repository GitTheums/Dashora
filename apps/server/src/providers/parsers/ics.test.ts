import { describe, expect, it } from "vitest";
import { IcsParseError, parseIcs, zonedLocalToUtcMs } from "./ics.js";

describe("ics parser", () => {
  it("parses timed events with IANA timezones", () => {
    const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Dashora//Test//EN
BEGIN:VEVENT
UID:tz-1@example.test
DTSTART;TZID=America/New_York:20260715T090000
DTEND;TZID=America/New_York:20260715T100000
SUMMARY:Morning standup
END:VEVENT
END:VCALENDAR`;

    const expectedStart = zonedLocalToUtcMs(2026, 7, 15, 9, 0, 0, "America/New_York");
    const expectedEnd = zonedLocalToUtcMs(2026, 7, 15, 10, 0, 0, "America/New_York");
    const parsed = parseIcs(ics, {
      rangeStartMs: Date.UTC(2026, 6, 1),
      rangeEndMs: Date.UTC(2026, 7, 1),
    });

    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0]?.summary).toBe("Morning standup");
    expect(parsed.events[0]?.allDay).toBe(false);
    expect(Date.parse(parsed.events[0]?.startsAt ?? "")).toBe(expectedStart);
    expect(Date.parse(parsed.events[0]?.endsAt ?? "")).toBe(expectedEnd);
  });

  it("parses UTC Z timestamps", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:utc-1@example.test
DTSTART:20260720T120000Z
DTEND:20260720T130000Z
SUMMARY:UTC meeting
END:VEVENT
END:VCALENDAR`;
    const parsed = parseIcs(ics, {
      rangeStartMs: Date.UTC(2026, 6, 1),
      rangeEndMs: Date.UTC(2026, 7, 1),
    });
    expect(parsed.events[0]?.startsAt).toBe("2026-07-20T12:00:00.000Z");
    expect(parsed.events[0]?.endsAt).toBe("2026-07-20T13:00:00.000Z");
  });

  it("parses all-day VALUE=DATE events with exclusive DTEND", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:allday-1@example.test
DTSTART;VALUE=DATE:20260704
DTEND;VALUE=DATE:20260706
SUMMARY:Holiday
CLASS:PUBLIC
END:VEVENT
END:VCALENDAR`;
    const parsed = parseIcs(ics, {
      rangeStartMs: Date.UTC(2026, 6, 1),
      rangeEndMs: Date.UTC(2026, 7, 1),
    });
    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0]?.allDay).toBe(true);
    expect(parsed.events[0]?.allDayDate).toBe("2026-07-04");
    expect(parsed.events[0]?.startsAt).toBe("2026-07-04T00:00:00.000Z");
    // Two-day span (4th and 5th); DTEND 6th is exclusive → 48h
    expect(parsed.events[0]?.endsAt).toBe("2026-07-06T00:00:00.000Z");
  });

  it("expands weekly RRULE with BYDAY and respects UNTIL", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:weekly-1@example.test
DTSTART;TZID=UTC:20260706T150000
DTEND;TZID=UTC:20260706T160000
RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20260723T000000Z
SUMMARY:Standup
END:VEVENT
END:VCALENDAR`;
    // 2026-07-06 is Monday
    const parsed = parseIcs(ics, {
      rangeStartMs: Date.UTC(2026, 6, 1),
      rangeEndMs: Date.UTC(2026, 7, 1),
    });
    const dates = parsed.events.map((event) => event.startsAt.slice(0, 10));
    expect(dates).toEqual([
      "2026-07-06", // Mo
      "2026-07-08", // We
      "2026-07-13",
      "2026-07-15",
      "2026-07-20",
      "2026-07-22",
    ]);
  });

  it("expands daily RRULE with COUNT and skips EXDATE", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:daily-1@example.test
DTSTART:20260701T090000Z
DTEND:20260701T093000Z
RRULE:FREQ=DAILY;COUNT=5
EXDATE:20260703T090000Z
SUMMARY:Daily check-in
END:VEVENT
END:VCALENDAR`;
    const parsed = parseIcs(ics, {
      rangeStartMs: Date.UTC(2026, 5, 30),
      rangeEndMs: Date.UTC(2026, 7, 10),
    });
    expect(parsed.events.map((event) => event.startsAt.slice(0, 10))).toEqual([
      "2026-07-01",
      "2026-07-02",
      "2026-07-04",
      "2026-07-05",
    ]);
  });

  it("expands monthly RRULE", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:monthly-1@example.test
DTSTART;VALUE=DATE:20260115
DTEND;VALUE=DATE:20260116
RRULE:FREQ=MONTHLY;COUNT=3
SUMMARY:Payday
END:VEVENT
END:VCALENDAR`;
    const parsed = parseIcs(ics, {
      rangeStartMs: Date.UTC(2026, 0, 1),
      rangeEndMs: Date.UTC(2026, 5, 1),
    });
    expect(parsed.events.map((event) => event.allDayDate)).toEqual([
      "2026-01-15",
      "2026-02-15",
      "2026-03-15",
    ]);
  });

  it("preserves CLASS privacy markers", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:private-1@example.test
DTSTART:20260710T180000Z
DTEND:20260710T190000Z
SUMMARY:Secret dinner
DESCRIPTION:Do not share
CLASS:PRIVATE
END:VEVENT
END:VCALENDAR`;
    const parsed = parseIcs(ics, {
      rangeStartMs: Date.UTC(2026, 6, 1),
      rangeEndMs: Date.UTC(2026, 7, 1),
    });
    expect(parsed.events[0]?.classification).toBe("PRIVATE");
    expect(parsed.events[0]?.summary).toBe("Secret dinner");
  });

  it("skips malformed VEVENT blocks while keeping valid ones", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:bad@example.test
SUMMARY:Missing start
END:VEVENT
BEGIN:VEVENT
UID:good@example.test
DTSTART:20260712T100000Z
DTEND:20260712T110000Z
SUMMARY:Valid event
END:VEVENT
END:VCALENDAR`;
    const parsed = parseIcs(ics, {
      rangeStartMs: Date.UTC(2026, 6, 1),
      rangeEndMs: Date.UTC(2026, 7, 1),
    });
    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0]?.summary).toBe("Valid event");
  });

  it("throws on empty documents", () => {
    expect(() => parseIcs("")).toThrow(IcsParseError);
  });

  it("throws when VCALENDAR is missing", () => {
    expect(() => parseIcs("BEGIN:VEVENT\nEND:VEVENT")).toThrow(/VCALENDAR/i);
  });

  it("throws on unclosed components", () => {
    expect(() =>
      parseIcs(`BEGIN:VCALENDAR
BEGIN:VEVENT
UID:x@example.test
DTSTART:20260701T090000Z
`),
    ).toThrow(/Unclosed/i);
  });

  it("handles folded lines", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:fold@example.test
DTSTART:20260718T120000Z
DTEND:20260718T130000Z
SUMMARY:This is a very long title that is
  folded across lines
END:VEVENT
END:VCALENDAR`;
    const parsed = parseIcs(ics, {
      rangeStartMs: Date.UTC(2026, 6, 1),
      rangeEndMs: Date.UTC(2026, 7, 1),
    });
    expect(parsed.events[0]?.summary).toBe("This is a very long title that is folded across lines");
  });

  it("reads calendar name and timezone metadata", () => {
    const ics = `BEGIN:VCALENDAR
X-WR-CALNAME:Family
X-WR-TIMEZONE:Europe/Amsterdam
BEGIN:VEVENT
UID:meta@example.test
DTSTART:20260701T090000Z
DTEND:20260701T100000Z
SUMMARY:Ping
END:VEVENT
END:VCALENDAR`;
    const parsed = parseIcs(ics, {
      rangeStartMs: Date.UTC(2026, 6, 1),
      rangeEndMs: Date.UTC(2026, 7, 1),
    });
    expect(parsed.calendarName).toBe("Family");
    expect(parsed.timezone).toBe("Europe/Amsterdam");
  });
});
