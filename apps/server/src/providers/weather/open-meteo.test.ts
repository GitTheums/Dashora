import { describe, expect, it } from "vitest";
import { createTestServerEnv } from "../../test/env.js";
import { createProviderPlatform } from "../platform.js";
import { createOpenMeteoWeatherAdapter } from "./open-meteo.js";

describe("Open-Meteo weather adapter", () => {
  it("searches locations and fetches a forecast", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("geocoding-api.open-meteo.com")) {
        return new Response(
          JSON.stringify({
            results: [
              {
                id: 1,
                name: "Amsterdam",
                latitude: 52.37,
                longitude: 4.89,
                timezone: "Europe/Amsterdam",
                country: "Netherlands",
                admin1: "North Holland",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("api.open-meteo.com")) {
        return new Response(
          JSON.stringify({
            timezone: "Europe/Amsterdam",
            current: {
              time: "2026-07-30T12:00",
              temperature_2m: 22.4,
              apparent_temperature: 21.1,
              relative_humidity_2m: 55,
              precipitation_probability: 20,
              weather_code: 1,
              wind_speed_10m: 12.2,
            },
            hourly: {
              time: ["2026-07-30T13:00"],
              temperature_2m: [23],
              precipitation_probability: [10],
              weather_code: [1],
            },
            daily: {
              time: ["2026-07-30"],
              temperature_2m_max: [24],
              temperature_2m_min: [16],
              precipitation_probability_max: [30],
              weather_code: [2],
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    };

    const platform = createProviderPlatform({
      env: createTestServerEnv(),
      fetchImpl,
    });
    const adapter = createOpenMeteoWeatherAdapter(platform);

    const locations = await adapter.searchLocations("Amsterdam");
    expect(locations).toHaveLength(1);
    expect(locations[0]?.name).toBe("Amsterdam");

    const location = locations[0];
    if (!location) {
      throw new Error("expected location");
    }

    const forecast = await adapter.fetchForecast({
      location,
      units: "metric",
      hourlyCount: 12,
      dailyCount: 7,
      now: new Date("2026-07-30T12:00:00.000Z"),
    });

    expect(forecast.forecast.current.temperature).toBe(22.4);
    expect(forecast.forecast.current.feelsLike).toBe(21.1);
    expect(forecast.forecast.current.precipitationProbability).toBe(20);
    expect(forecast.forecast.hourly).toHaveLength(1);
    expect(forecast.forecast.daily).toHaveLength(1);
    expect(forecast.forecast.providerId).toBe("open-meteo");
  });
});
