import type { CSSProperties } from "react";
import { widgetMutedStyle, widgetShellStyle } from "../_shared/chrome.js";
import type { WeatherData, WeatherLayout } from "./config.js";
import {
  formatDayLabel,
  formatHourLabel,
  formatObservedAt,
  formatPrecipitationProbability,
  formatTemperature,
  formatWindSpeed,
} from "./format.js";

const pulse: CSSProperties = {
  borderRadius: "0.25rem",
  background: "var(--ds-surface-3, #e3e8ed)",
};

export function WeatherSkeleton({ layout = "detailed" }: { layout?: WeatherLayout }) {
  return (
    <div style={widgetShellStyle} aria-busy="true" aria-live="polite" aria-label="Loading weather">
      <div style={{ ...pulse, height: "0.75rem", width: "45%" }} />
      <div style={{ ...pulse, height: "2.5rem", width: "35%" }} />
      <div style={{ ...pulse, height: "0.875rem", width: "55%" }} />
      {layout === "detailed" ? (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: "0.5rem",
              marginTop: "0.25rem",
            }}
          >
            {["a", "b", "c", "d"].map((id) => (
              <div key={id} style={{ ...pulse, height: "3.25rem" }} />
            ))}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              gap: "0.35rem",
            }}
          >
            {["d1", "d2", "d3", "d4", "d5", "d6", "d7"].map((id) => (
              <div key={id} style={{ ...pulse, height: "3.5rem" }} />
            ))}
          </div>
        </>
      ) : (
        <div style={{ ...pulse, height: "2.5rem", width: "100%", marginTop: "0.25rem" }} />
      )}
    </div>
  );
}

const metaGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(5.5rem, 1fr))",
  gap: "0.65rem",
};

const metaLabel: CSSProperties = {
  ...widgetMutedStyle,
  fontSize: "0.75rem",
};

const metaValue: CSSProperties = {
  margin: 0,
  fontSize: "0.9375rem",
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
};

function CompactWeatherBody({ data }: { data: WeatherData }) {
  return (
    <div style={widgetShellStyle}>
      <p style={{ ...widgetMutedStyle, margin: 0 }}>{data.location.name}</p>
      <p
        style={{
          margin: 0,
          fontSize: "2rem",
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.1,
        }}
      >
        {formatTemperature(data.current.temperature, data.units)}
      </p>
      <p style={{ margin: 0, fontSize: "0.9375rem" }}>{data.current.condition.label}</p>
      <p style={widgetMutedStyle}>
        Feels like {formatTemperature(data.current.feelsLike, data.units)}
        {data.current.precipitationProbability !== null
          ? ` · Precip ${formatPrecipitationProbability(data.current.precipitationProbability)}`
          : ""}
      </p>
    </div>
  );
}

function DetailedWeatherBody({ data }: { data: WeatherData }) {
  return (
    <div style={widgetShellStyle}>
      <div>
        <p style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600 }}>{data.location.name}</p>
        <p style={widgetMutedStyle}>
          <time dateTime={data.current.observedAt}>
            {formatObservedAt(data.current.observedAt, data.timezone)}
          </time>
          {data.location.country ? ` · ${data.location.country}` : ""}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          gap: "1rem",
          justifyContent: "space-between",
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontSize: "2.25rem",
              fontWeight: 600,
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1.1,
            }}
          >
            {formatTemperature(data.current.temperature, data.units)}
          </p>
          <p style={{ margin: "0.25rem 0 0", fontSize: "1rem" }}>{data.current.condition.label}</p>
        </div>
        <div style={metaGrid}>
          <div>
            <p style={metaLabel}>Feels like</p>
            <p style={metaValue}>{formatTemperature(data.current.feelsLike, data.units)}</p>
          </div>
          <div>
            <p style={metaLabel}>Precip</p>
            <p style={metaValue}>
              {formatPrecipitationProbability(data.current.precipitationProbability)}
            </p>
          </div>
          <div>
            <p style={metaLabel}>Humidity</p>
            <p style={metaValue}>
              {data.current.humidity !== null ? `${data.current.humidity}%` : "—"}
            </p>
          </div>
          <div>
            <p style={metaLabel}>Wind</p>
            <p style={metaValue}>{formatWindSpeed(data.current.windSpeed, data.units)}</p>
          </div>
        </div>
      </div>

      {data.showHourly && data.hourly.length > 0 ? (
        <div>
          <p style={{ ...metaLabel, marginBottom: "0.35rem" }}>Hourly</p>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "grid",
              gridAutoFlow: "column",
              gridAutoColumns: "minmax(3.25rem, 1fr)",
              gap: "0.35rem",
              overflowX: "auto",
            }}
          >
            {data.hourly.map((point) => (
              <li
                key={point.time}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.2rem",
                  alignItems: "center",
                  textAlign: "center",
                  padding: "0.4rem 0.25rem",
                  borderRadius: "var(--ds-radius-md, 0.5rem)",
                  background: "var(--ds-surface-2, #f3f6f8)",
                }}
              >
                <span style={{ fontSize: "0.75rem", color: "var(--ds-fg-muted, #55606c)" }}>
                  <time dateTime={point.time}>{formatHourLabel(point.time, data.timezone)}</time>
                </span>
                <span
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatTemperature(point.temperature, data.units)}
                </span>
                <span style={{ fontSize: "0.6875rem", color: "var(--ds-fg-muted, #55606c)" }}>
                  {formatPrecipitationProbability(point.precipitationProbability)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {data.showDaily && data.daily.length > 0 ? (
        <div>
          <p style={{ ...metaLabel, marginBottom: "0.35rem" }}>Daily</p>
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem",
            }}
          >
            {data.daily.map((point) => (
              <li
                key={point.date}
                style={{
                  display: "grid",
                  gridTemplateColumns: "3.5rem 1fr auto auto",
                  gap: "0.5rem",
                  alignItems: "center",
                  fontSize: "0.875rem",
                }}
              >
                <span style={{ fontWeight: 600 }}>{formatDayLabel(point.date, data.timezone)}</span>
                <span style={widgetMutedStyle}>{point.condition.label}</span>
                <span
                  style={{
                    color: "var(--ds-fg-muted, #55606c)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatPrecipitationProbability(point.precipitationProbabilityMax)}
                </span>
                <span style={{ fontVariantNumeric: "tabular-nums", textAlign: "right" }}>
                  {formatTemperature(point.tempMax, data.units)} /{" "}
                  {formatTemperature(point.tempMin, data.units)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function WeatherBody({ data }: { data: WeatherData }) {
  if (data.layout === "compact") {
    return <CompactWeatherBody data={data} />;
  }
  return <DetailedWeatherBody data={data} />;
}
