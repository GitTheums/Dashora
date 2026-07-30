import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import type { WeatherClient } from "./client.js";
import { WEATHER_DEFAULT_CONFIG, type WeatherData } from "./config.js";
import { WeatherRenderer } from "./renderer.js";
import { WeatherSettings } from "./settings.js";

const sampleData: WeatherData = {
  location: {
    name: "Amsterdam",
    latitude: 52.37,
    longitude: 4.89,
    timezone: "Europe/Amsterdam",
    country: "Netherlands",
    admin1: "North Holland",
  },
  units: "metric",
  layout: "detailed",
  showHourly: true,
  showDaily: true,
  current: {
    temperature: 22,
    feelsLike: 21,
    humidity: 55,
    windSpeed: 12,
    precipitationProbability: 20,
    condition: { code: 1, label: "Mainly clear" },
    observedAt: "2026-07-30T12:00:00.000Z",
  },
  hourly: [
    {
      time: "2026-07-30T13:00:00.000Z",
      temperature: 23,
      precipitationProbability: 10,
      condition: { code: 1, label: "Mainly clear" },
    },
  ],
  daily: [
    {
      date: "2026-07-30",
      tempMax: 24,
      tempMin: 16,
      precipitationProbabilityMax: 30,
      condition: { code: 2, label: "Partly cloudy" },
    },
  ],
  providerId: "open-meteo",
  fetchedAt: "2026-07-30T12:00:00.000Z",
  timezone: "Europe/Amsterdam",
};

afterEach(() => {
  cleanup();
});

describe("WeatherRenderer", () => {
  it.each(REQUIRED_WIDGET_STATES)("renders state=%s", (state) => {
    render(
      <WeatherRenderer
        instanceId="1"
        title="Weather"
        config={{ ...WEATHER_DEFAULT_CONFIG, location: sampleData.location }}
        state={state}
        {...(state === "success" || state === "empty" || state === "stale" || state === "refreshing"
          ? { data: sampleData }
          : {})}
        message={`msg-${state}`}
      />,
    );
    expect(document.querySelector(`[data-widget="weather"][data-state="${state}"]`)).toBeTruthy();
  });

  it("renders detailed forecast content", () => {
    render(
      <WeatherRenderer
        instanceId="1"
        title="Weather"
        config={{ ...WEATHER_DEFAULT_CONFIG, location: sampleData.location }}
        state="success"
        data={sampleData}
      />,
    );
    expect(screen.getByText("Amsterdam")).toBeTruthy();
    expect(screen.getByText("Mainly clear")).toBeTruthy();
    expect(screen.getByText("Feels like")).toBeTruthy();
    expect(screen.getByText("Hourly")).toBeTruthy();
    expect(screen.getByText("Daily")).toBeTruthy();
  });

  it("renders compact layout without hourly section labels", () => {
    render(
      <WeatherRenderer
        instanceId="1"
        title="Weather"
        config={{
          ...WEATHER_DEFAULT_CONFIG,
          location: sampleData.location,
          layout: "compact",
        }}
        state="success"
        data={{ ...sampleData, layout: "compact" }}
      />,
    );
    expect(screen.getByText(/Feels like/)).toBeTruthy();
    expect(screen.queryByText("Hourly")).toBeNull();
  });
});

describe("WeatherSettings", () => {
  it("renders location search and unit controls", () => {
    const client: WeatherClient = {
      fetchData: vi.fn(),
      searchLocations: vi.fn(async () => ({ results: [] })),
    };
    render(
      <WeatherSettings
        instanceId="1"
        config={WEATHER_DEFAULT_CONFIG}
        onChange={() => undefined}
        client={client}
      />,
    );
    expect(screen.getByLabelText("Location")).toBeTruthy();
    expect(screen.getByLabelText("Units")).toBeTruthy();
    expect(screen.getByLabelText("Layout")).toBeTruthy();
  });
});
