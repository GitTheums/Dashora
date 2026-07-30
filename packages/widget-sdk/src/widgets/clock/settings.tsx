import type { FormEvent } from "react";
import type { WidgetSettingsProps } from "../../registry/types.js";
import {
  widgetFieldStyle,
  widgetInputStyle,
  widgetLabelStyle,
  widgetMutedStyle,
} from "../_shared/chrome.js";
import {
  type ClockConfig,
  type ClockDateFormat,
  type ClockHourFormat,
  clockConfigSchema,
} from "./config.js";

const DATE_FORMAT_OPTIONS: Array<{ value: ClockDateFormat; label: string }> = [
  { value: "full", label: "Full" },
  { value: "long", label: "Long" },
  { value: "medium", label: "Medium" },
  { value: "short", label: "Short" },
  { value: "none", label: "Hidden" },
];

export function ClockSettings({
  config,
  onChange,
  onSubmit,
  disabled = false,
}: WidgetSettingsProps<ClockConfig>) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.(clockConfigSchema.parse(config));
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Clock settings"
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="clock-timezone">
          Timezone
        </label>
        <input
          id="clock-timezone"
          style={widgetInputStyle}
          value={config.timezone}
          disabled={disabled}
          placeholder="UTC or Europe/Amsterdam"
          onChange={(event) => onChange({ ...config, timezone: event.target.value })}
        />
        <p style={widgetMutedStyle}>Use an IANA timezone name.</p>
      </div>

      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="clock-hour-format">
          Hour format
        </label>
        <select
          id="clock-hour-format"
          style={widgetInputStyle}
          value={config.hourFormat}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...config, hourFormat: event.target.value as ClockHourFormat })
          }
        >
          <option value="24">24-hour</option>
          <option value="12">12-hour</option>
        </select>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input
          id="clock-seconds"
          type="checkbox"
          checked={config.showSeconds}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, showSeconds: event.target.checked })}
        />
        <label style={widgetLabelStyle} htmlFor="clock-seconds">
          Show seconds
        </label>
      </div>

      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="clock-secondary">
          Secondary timezone (optional)
        </label>
        <input
          id="clock-secondary"
          style={widgetInputStyle}
          value={config.secondaryTimezone ?? ""}
          disabled={disabled}
          placeholder="America/New_York"
          onChange={(event) =>
            onChange({
              ...config,
              secondaryTimezone: event.target.value.trim() ? event.target.value : null,
            })
          }
        />
      </div>

      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="clock-date-format">
          Date format
        </label>
        <select
          id="clock-date-format"
          style={widgetInputStyle}
          value={config.dateFormat}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...config, dateFormat: event.target.value as ClockDateFormat })
          }
        >
          {DATE_FORMAT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {onSubmit ? (
        <button type="submit" disabled={disabled}>
          Save settings
        </button>
      ) : null}
    </form>
  );
}
