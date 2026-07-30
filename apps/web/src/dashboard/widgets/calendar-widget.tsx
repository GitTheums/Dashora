import { cx } from "@dashora/ui";
import { mockCalendar } from "../mock-data.js";
import { WidgetShell } from "../widget-shell.js";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function CalendarWidget() {
  return (
    <WidgetShell
      title="Calendar"
      description={`${mockCalendar.monthLabel} · ${mockCalendar.weekLabel}`}
      variant="default"
      colSpan={3}
      tabletSpan={4}
      mobileSpan={4}
    >
      <div className="calendar-widget">
        <div className="calendar-widget__grid" aria-label="July calendar">
          {WEEKDAYS.map((day) => (
            <span key={day} className="calendar-widget__weekday">
              {day}
            </span>
          ))}
          {mockCalendar.days.map((day, index) => (
            <span
              key={`${day.date}-${index}`}
              className={cx(
                "calendar-widget__day",
                day.outside && "calendar-widget__day--outside",
                day.today && "calendar-widget__day--today",
                day.event && "calendar-widget__day--event",
              )}
              aria-current={day.today ? "date" : undefined}
            >
              {day.date}
            </span>
          ))}
        </div>
        <ul className="calendar-widget__events">
          {mockCalendar.upcoming.map((event) => (
            <li key={event.title} className="calendar-widget__event">
              <span className="meta-value">{event.time}</span>
              <div>
                <p className="list-title">{event.title}</p>
                <p className="list-meta">{event.when}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </WidgetShell>
  );
}
