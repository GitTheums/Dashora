import type { CSSProperties, ReactNode } from "react";
import { widgetMutedStyle, widgetShellStyle } from "../_shared/chrome.js";
import {
  CALENDAR_COLOR_CSS,
  type CalendarData,
  type CalendarEvent,
  type CalendarLayout,
} from "./config.js";
import { formatEventDate, formatEventTime } from "./sanitize.js";

const pulse: CSSProperties = {
  borderRadius: "0.25rem",
  background: "var(--ds-surface-3, #e3e8ed)",
};

export function CalendarSkeleton({ layout = "agenda" }: { layout?: CalendarLayout }) {
  const skeletonCells = [
    "s1",
    "s2",
    "s3",
    "s4",
    "s5",
    "s6",
    "s7",
    "s8",
    "s9",
    "s10",
    "s11",
    "s12",
    "s13",
    "s14",
  ];
  return (
    <div style={widgetShellStyle} aria-busy="true" aria-live="polite" aria-label="Loading calendar">
      {layout === "month-summary" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
            gap: "0.35rem",
          }}
        >
          {skeletonCells.map((id) => (
            <div key={id} style={{ ...pulse, height: "2.25rem" }} />
          ))}
        </div>
      ) : (
        ["r1", "r2", "r3", "r4"].map((id, index) => (
          <div key={id} style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <div style={{ ...pulse, height: "0.9rem", width: index % 2 === 0 ? "72%" : "58%" }} />
            <div style={{ ...pulse, height: "0.7rem", width: "40%" }} />
          </div>
        ))
      )}
    </div>
  );
}

function ColorDot({ color }: { color: CalendarEvent["color"] }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: "0.55rem",
        height: "0.55rem",
        borderRadius: "999px",
        background: CALENDAR_COLOR_CSS[color],
        flexShrink: 0,
        marginTop: "0.35rem",
      }}
    />
  );
}

function EventRow({
  event,
  data,
  showDate,
}: {
  event: CalendarEvent;
  data: CalendarData;
  showDate: boolean;
}) {
  const timeLabel = formatEventTime(event.startsAt, data.timezone, event.allDay);
  const dateLabel = showDate
    ? formatEventDate(event.startsAt, data.timezone, event.allDay, event.allDayDate)
    : null;

  return (
    <li
      style={{
        display: "flex",
        gap: "0.65rem",
        alignItems: "flex-start",
      }}
    >
      <ColorDot color={event.color} />
      <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", minWidth: 0 }}>
        <p style={{ margin: 0, fontWeight: 600, fontSize: "0.9375rem" }}>{event.title}</p>
        <p style={{ ...widgetMutedStyle, margin: 0, fontSize: "0.75rem" }}>
          {dateLabel ? (
            <>
              <span>{dateLabel}</span>
              <span aria-hidden="true"> · </span>
            </>
          ) : null}
          <time dateTime={event.startsAt}>{timeLabel}</time>
          <span aria-hidden="true"> · </span>
          <span>{event.feedTitle}</span>
        </p>
        {!data.hideDescriptions && event.description ? (
          <p style={{ ...widgetMutedStyle, margin: 0 }}>{event.description}</p>
        ) : null}
        {event.location ? (
          <p style={{ ...widgetMutedStyle, margin: 0, fontSize: "0.75rem" }}>{event.location}</p>
        ) : null}
      </div>
    </li>
  );
}

function DayLayout({ data }: { data: CalendarData }) {
  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      {data.events.map((event) => (
        <EventRow key={event.id} event={event} data={data} showDate={false} />
      ))}
    </ul>
  );
}

function AgendaLayout({ data }: { data: CalendarData }) {
  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      {data.events.map((event) => (
        <EventRow key={event.id} event={event} data={data} showDate />
      ))}
    </ul>
  );
}

function MonthSummaryLayout({ data }: { data: CalendarData }) {
  const weekdayLabels = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  const padKeys = ["pad-a", "pad-b", "pad-c", "pad-d", "pad-e", "pad-f"];
  // Align first cell to Monday of the week containing today when possible
  const first = data.daySummaries[0];
  let pad = 0;
  if (first) {
    const [y, m, d] = first.date.split("-").map(Number);
    const dow = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
    pad = (dow + 6) % 7; // Monday=0
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: "0.35rem",
        }}
        aria-label="Calendar month summary"
      >
        {weekdayLabels.map((label) => (
          <div
            key={label}
            style={{
              ...widgetMutedStyle,
              textAlign: "center",
              fontSize: "0.7rem",
              fontWeight: 600,
            }}
          >
            {label}
          </div>
        ))}
        {padKeys.slice(0, pad).map((key) => (
          <div key={key} aria-hidden="true" />
        ))}
        {data.daySummaries.map((day) => {
          const dayNum = Number(day.date.slice(8, 10));
          return (
            <div
              key={day.date}
              aria-current={day.isToday ? "date" : undefined}
              aria-label={`${day.date}: ${day.eventCount} event${day.eventCount === 1 ? "" : "s"}`}
              style={{
                minHeight: "2.4rem",
                borderRadius: "var(--ds-radius-sm, 0.35rem)",
                border: day.isToday
                  ? "2px solid var(--ds-primary, #2f6fed)"
                  : "1px solid var(--ds-border, rgba(18, 23, 28, 0.1))",
                background: day.eventCount > 0 ? "var(--ds-surface-2, #f3f6f8)" : "transparent",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.15rem",
                fontSize: "0.75rem",
                fontWeight: day.isToday ? 700 : 500,
              }}
            >
              <span>{dayNum}</span>
              {day.eventCount > 0 ? (
                <span style={{ ...widgetMutedStyle, fontSize: "0.65rem", margin: 0 }}>
                  {day.eventCount}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
      {data.events.length > 0 ? (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.55rem",
          }}
        >
          {data.events.slice(0, 8).map((event) => (
            <EventRow key={event.id} event={event} data={data} showDate />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function CalendarBody({ data }: { data: CalendarData }) {
  let content: ReactNode;
  switch (data.layout) {
    case "day":
      content = <DayLayout data={data} />;
      break;
    case "month-summary":
      content = <MonthSummaryLayout data={data} />;
      break;
    default:
      content = <AgendaLayout data={data} />;
  }

  return (
    <div style={widgetShellStyle}>
      {data.failedFeedCount > 0 ? (
        <p style={{ ...widgetMutedStyle, margin: 0 }}>
          {data.failedFeedCount} feed{data.failedFeedCount === 1 ? "" : "s"} could not be loaded.
        </p>
      ) : null}
      <p style={{ ...widgetMutedStyle, margin: 0, fontSize: "0.75rem" }}>
        Today · {data.today} · {data.timezone.replaceAll("_", " ")}
      </p>
      {content}
    </div>
  );
}
