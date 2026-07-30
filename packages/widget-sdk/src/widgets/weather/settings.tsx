import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import type { WidgetSettingsProps } from "../../registry/types.js";
import {
  widgetFieldStyle,
  widgetInputStyle,
  widgetLabelStyle,
  widgetMutedStyle,
} from "../_shared/chrome.js";
import { type WeatherClient, defaultWeatherClient } from "./client.js";
import {
  type WeatherConfig,
  type WeatherLayout,
  type WeatherLocation,
  type WeatherUnits,
  weatherConfigSchema,
} from "./config.js";

export type WeatherSettingsProps = WidgetSettingsProps<WeatherConfig> & {
  client?: WeatherClient;
};

function formatLocationOption(location: WeatherLocation): string {
  const parts = [location.name];
  if (location.admin1) {
    parts.push(location.admin1);
  }
  if (location.country) {
    parts.push(location.country);
  }
  return parts.join(", ");
}

export function WeatherSettings({
  config,
  onChange,
  onSubmit,
  disabled = false,
  client = defaultWeatherClient,
}: WeatherSettingsProps) {
  const searchId = useId();
  const [query, setQuery] = useState(config.location?.name ?? "");
  const [results, setResults] = useState<WeatherLocation[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.(weatherConfigSchema.parse(config));
  };

  const runSearch = async () => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchError("Enter at least 2 characters to search.");
      setResults([]);
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSearching(true);
    setSearchError(null);
    try {
      const response = await client.searchLocations(trimmed, {
        signal: controller.signal,
        limit: 8,
      });
      setResults(response.results);
      if (response.results.length === 0) {
        setSearchError("No locations matched that search.");
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      setResults([]);
      setSearchError(error instanceof Error ? error.message : "Location search failed.");
    } finally {
      if (!controller.signal.aborted) {
        setSearching(false);
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Weather settings"
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor={searchId}>
          Location
        </label>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <input
            id={searchId}
            style={{ ...widgetInputStyle, flex: "1 1 12rem" }}
            value={query}
            disabled={disabled || searching}
            placeholder="City or place name"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void runSearch();
              }
            }}
          />
          <button type="button" disabled={disabled || searching} onClick={() => void runSearch()}>
            {searching ? "Searching…" : "Search"}
          </button>
        </div>
        {config.location ? (
          <p style={widgetMutedStyle}>Selected: {formatLocationOption(config.location)}</p>
        ) : (
          <p style={widgetMutedStyle}>Choose a location to enable the forecast.</p>
        )}
        {searchError ? (
          <p role="alert" style={{ ...widgetMutedStyle, color: "var(--ds-danger, #c43c3c)" }}>
            {searchError}
          </p>
        ) : null}
        {results.length > 0 ? (
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
            {results.map((location) => {
              const key = `${location.latitude},${location.longitude},${location.name}`;
              return (
                <li key={key}>
                  <button
                    type="button"
                    disabled={disabled}
                    style={{
                      ...widgetInputStyle,
                      width: "100%",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      onChange({ ...config, location });
                      setQuery(location.name);
                      setResults([]);
                      setSearchError(null);
                    }}
                  >
                    {formatLocationOption(location)}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="weather-units">
          Units
        </label>
        <select
          id="weather-units"
          style={widgetInputStyle}
          value={config.units}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, units: event.target.value as WeatherUnits })}
        >
          <option value="metric">Metric (°C, km/h)</option>
          <option value="imperial">Imperial (°F, mph)</option>
        </select>
      </div>

      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="weather-layout">
          Layout
        </label>
        <select
          id="weather-layout"
          style={widgetInputStyle}
          value={config.layout}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, layout: event.target.value as WeatherLayout })}
        >
          <option value="compact">Compact</option>
          <option value="detailed">Detailed</option>
        </select>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input
          id="weather-hourly"
          type="checkbox"
          checked={config.showHourly}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, showHourly: event.target.checked })}
        />
        <label style={widgetLabelStyle} htmlFor="weather-hourly">
          Show hourly forecast
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input
          id="weather-daily"
          type="checkbox"
          checked={config.showDaily}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, showDaily: event.target.checked })}
        />
        <label style={widgetLabelStyle} htmlFor="weather-daily">
          Show daily forecast
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input
          id="weather-enabled"
          type="checkbox"
          checked={config.enabled}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, enabled: event.target.checked })}
        />
        <label style={widgetLabelStyle} htmlFor="weather-enabled">
          Enabled
        </label>
      </div>

      {onSubmit ? (
        <button type="submit" disabled={disabled}>
          Save settings
        </button>
      ) : null}
    </form>
  );
}
