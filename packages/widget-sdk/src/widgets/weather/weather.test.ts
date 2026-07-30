import { describe, expect, it, vi } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import type { WeatherProviderAdapter } from "./adapter.js";
import {
  WEATHER_DEFAULT_CONFIG,
  type WeatherData,
  type WeatherLocation,
  weatherConfigSchema,
} from "./config.js";
import { weatherDefinition } from "./definition.js";
import { formatTemperature } from "./format.js";
import { createWeatherProvider } from "./provider.js";

const location: WeatherLocation = {
  name: "Amsterdam",
  latitude: 52.37,
  longitude: 4.89,
  timezone: "Europe/Amsterdam",
  country: "Netherlands",
  admin1: "North Holland",
};

function sampleForecast(now = "2026-07-30T12:00:00.000Z"): WeatherData {
  return {
    location,
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
      observedAt: now,
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
    fetchedAt: now,
    timezone: "Europe/Amsterdam",
  };
}

function createMockAdapter(
  overrides: Partial<WeatherProviderAdapter> = {},
): WeatherProviderAdapter {
  return {
    id: "mock",
    searchLocations: vi.fn(async () => [location]),
    fetchForecast: vi.fn(async () => ({
      forecast: {
        location,
        units: "metric" as const,
        current: sampleForecast().current,
        hourly: sampleForecast().hourly,
        daily: sampleForecast().daily,
        providerId: "mock",
        fetchedAt: "2026-07-30T12:00:00.000Z",
        timezone: "Europe/Amsterdam",
      },
      cacheStatus: "miss" as const,
    })),
    ...overrides,
  };
}

describe("weather definition", () => {
  it("covers every required runtime state", () => {
    expect(weatherDefinition.states).toEqual(REQUIRED_WIDGET_STATES);
    expect(weatherDefinition.id).toBe("weather");
  });

  it("parses default config", () => {
    expect(weatherConfigSchema.parse({})).toEqual(WEATHER_DEFAULT_CONFIG);
  });
});

describe("weather formatting", () => {
  it("formats temperatures for both unit systems", () => {
    expect(formatTemperature(21.6, "metric")).toBe("22°C");
    expect(formatTemperature(70.4, "imperial")).toBe("70°F");
  });
});

describe("weather provider", () => {
  it("returns configuration-required without a location", async () => {
    const provider = createWeatherProvider({ adapter: createMockAdapter() });
    const result = await provider.fetch({
      instanceId: "w1",
      config: WEATHER_DEFAULT_CONFIG,
    });
    expect(result.state).toBe("configuration-required");
  });

  it("returns disabled when enabled is false", async () => {
    const provider = createWeatherProvider({ adapter: createMockAdapter() });
    const result = await provider.fetch({
      instanceId: "w2",
      config: { ...WEATHER_DEFAULT_CONFIG, enabled: false, location },
    });
    expect(result.state).toBe("disabled");
  });

  it("returns success with forecast data", async () => {
    const adapter = createMockAdapter();
    const provider = createWeatherProvider({ adapter });
    const result = await provider.fetch({
      instanceId: "w3",
      config: { ...WEATHER_DEFAULT_CONFIG, location },
    });
    expect(result.state).toBe("success");
    expect(result.data?.current.temperature).toBe(22);
    expect(result.data?.hourly).toHaveLength(1);
    expect(adapter.fetchForecast).toHaveBeenCalled();
  });

  it("returns stale when the adapter reports stale cache", async () => {
    const adapter = createMockAdapter({
      fetchForecast: vi.fn(async () => ({
        forecast: {
          location,
          units: "metric" as const,
          current: sampleForecast().current,
          hourly: sampleForecast().hourly,
          daily: sampleForecast().daily,
          providerId: "mock",
          fetchedAt: "2026-07-30T11:00:00.000Z",
          timezone: "Europe/Amsterdam",
        },
        cacheStatus: "stale" as const,
      })),
    });
    const provider = createWeatherProvider({ adapter });
    const result = await provider.fetch({
      instanceId: "w4",
      config: { ...WEATHER_DEFAULT_CONFIG, location },
    });
    expect(result.state).toBe("stale");
    expect(result.cacheStatus).toBe("stale");
  });

  it("returns error when the adapter throws", async () => {
    const adapter = createMockAdapter({
      fetchForecast: vi.fn(async () => {
        throw new Error("upstream down");
      }),
    });
    const provider = createWeatherProvider({ adapter });
    const result = await provider.fetch({
      instanceId: "w5",
      config: { ...WEATHER_DEFAULT_CONFIG, location },
    });
    expect(result.state).toBe("error");
    expect(result.errorCode).toBe("weather_fetch_failed");
  });

  it("hides hourly and daily when toggled off", async () => {
    const provider = createWeatherProvider({ adapter: createMockAdapter() });
    const result = await provider.fetch({
      instanceId: "w6",
      config: {
        ...WEATHER_DEFAULT_CONFIG,
        location,
        showHourly: false,
        showDaily: false,
      },
    });
    expect(result.state).toBe("success");
    expect(result.data?.hourly).toEqual([]);
    expect(result.data?.daily).toEqual([]);
  });
});
