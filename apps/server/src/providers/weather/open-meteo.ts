import {
  type WeatherForecastPayload,
  type WeatherForecastRequest,
  type WeatherForecastResult,
  type WeatherLocationSearchResult,
  type WeatherProviderAdapter,
  weatherConditionFromCode,
} from "@dashora/widget-sdk/widgets/weather/server";
import type { ProviderPlatform } from "../platform.js";

const GEOCODING_BASE = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_BASE = "https://api.open-meteo.com/v1/forecast";

type OpenMeteoGeocodingResponse = {
  results?: Array<{
    id?: number;
    name?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
    country?: string;
    admin1?: string;
  }>;
};

type OpenMeteoForecastResponse = {
  timezone?: string;
  current?: {
    time?: string;
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    precipitation_probability?: number;
    weather_code?: number;
    wind_speed_10m?: number;
  };
  hourly?: {
    time?: string[];
    temperature_2m?: Array<number | null>;
    precipitation_probability?: Array<number | null>;
    weather_code?: Array<number | null>;
  };
  daily?: {
    time?: string[];
    temperature_2m_max?: Array<number | null>;
    temperature_2m_min?: Array<number | null>;
    precipitation_probability_max?: Array<number | null>;
    weather_code?: Array<number | null>;
  };
};

function toIso(value: string | undefined, fallback: Date): string {
  if (!value) {
    return fallback.toISOString();
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    // Open-Meteo may return local timestamps without offset; treat as-is via Date.
    const loose = new Date(value);
    if (!Number.isNaN(loose.getTime())) {
      return loose.toISOString();
    }
    return fallback.toISOString();
  }
  return new Date(parsed).toISOString();
}

function nullableNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nullableInt(value: number | null | undefined): number | null {
  const n = nullableNumber(value);
  return n === null ? null : Math.round(n);
}

export function createOpenMeteoWeatherAdapter(platform: ProviderPlatform): WeatherProviderAdapter {
  return {
    id: "open-meteo",

    async searchLocations(query, options = {}) {
      const trimmed = query.trim();
      if (trimmed.length < 2) {
        return [];
      }
      const limit = Math.min(Math.max(options.limit ?? 8, 1), 20);
      const url = new URL(GEOCODING_BASE);
      url.searchParams.set("name", trimmed);
      url.searchParams.set("count", String(limit));
      url.searchParams.set("language", "en");
      url.searchParams.set("format", "json");

      const { data } = await platform.fetchJson<OpenMeteoGeocodingResponse>({
        providerId: "weather",
        url: url.toString(),
        ...(options.signal ? { signal: options.signal } : {}),
        cachePolicy: { ttlSeconds: 86_400, staleWhileRevalidateSeconds: 86_400 },
      });

      const results: WeatherLocationSearchResult[] = [];
      for (const row of data.results ?? []) {
        if (
          typeof row.name !== "string" ||
          typeof row.latitude !== "number" ||
          typeof row.longitude !== "number"
        ) {
          continue;
        }
        results.push({
          ...(row.id !== undefined ? { id: String(row.id) } : {}),
          name: row.name,
          latitude: row.latitude,
          longitude: row.longitude,
          timezone: row.timezone ?? null,
          country: row.country ?? null,
          admin1: row.admin1 ?? null,
        });
      }
      return results;
    },

    async fetchForecast(request: WeatherForecastRequest): Promise<WeatherForecastResult> {
      const now = request.now ?? new Date();
      const url = new URL(FORECAST_BASE);
      url.searchParams.set("latitude", String(request.location.latitude));
      url.searchParams.set("longitude", String(request.location.longitude));
      url.searchParams.set(
        "current",
        [
          "temperature_2m",
          "relative_humidity_2m",
          "apparent_temperature",
          "precipitation_probability",
          "weather_code",
          "wind_speed_10m",
        ].join(","),
      );
      url.searchParams.set(
        "hourly",
        ["temperature_2m", "precipitation_probability", "weather_code"].join(","),
      );
      url.searchParams.set(
        "daily",
        [
          "weather_code",
          "temperature_2m_max",
          "temperature_2m_min",
          "precipitation_probability_max",
        ].join(","),
      );
      url.searchParams.set("timezone", request.location.timezone || "auto");
      url.searchParams.set(
        "temperature_unit",
        request.units === "metric" ? "celsius" : "fahrenheit",
      );
      url.searchParams.set("wind_speed_unit", request.units === "metric" ? "kmh" : "mph");
      url.searchParams.set("forecast_days", String(Math.min(16, Math.max(1, request.dailyCount))));

      const { data, result } = await platform.fetchJson<OpenMeteoForecastResponse>({
        providerId: "weather",
        url: url.toString(),
        ...(request.signal ? { signal: request.signal } : {}),
        ...(request.forceRefresh !== undefined ? { forceRefresh: request.forceRefresh } : {}),
        cachePolicy: { ttlSeconds: 600, staleWhileRevalidateSeconds: 1800 },
      });

      const timezone = data.timezone || request.location.timezone || "UTC";
      const current = data.current ?? {};
      const weatherCode = typeof current.weather_code === "number" ? current.weather_code : -1;

      const hourly: WeatherForecastPayload["hourly"] = [];
      const hourlyTimes = data.hourly?.time ?? [];
      for (let i = 0; i < hourlyTimes.length && hourly.length < request.hourlyCount; i++) {
        const time = hourlyTimes[i];
        if (!time) {
          continue;
        }
        const temp = data.hourly?.temperature_2m?.[i];
        if (typeof temp !== "number") {
          continue;
        }
        const code = data.hourly?.weather_code?.[i];
        hourly.push({
          time: toIso(time, now),
          temperature: temp,
          precipitationProbability: nullableInt(data.hourly?.precipitation_probability?.[i]),
          condition: weatherConditionFromCode(typeof code === "number" ? code : -1),
        });
      }

      const daily: WeatherForecastPayload["daily"] = [];
      const dailyTimes = data.daily?.time ?? [];
      for (let i = 0; i < dailyTimes.length && daily.length < request.dailyCount; i++) {
        const date = dailyTimes[i];
        if (!date) {
          continue;
        }
        const tempMax = data.daily?.temperature_2m_max?.[i];
        const tempMin = data.daily?.temperature_2m_min?.[i];
        if (typeof tempMax !== "number" || typeof tempMin !== "number") {
          continue;
        }
        const code = data.daily?.weather_code?.[i];
        daily.push({
          date,
          tempMax,
          tempMin,
          precipitationProbabilityMax: nullableInt(data.daily?.precipitation_probability_max?.[i]),
          condition: weatherConditionFromCode(typeof code === "number" ? code : -1),
        });
      }

      if (typeof current.temperature_2m !== "number") {
        throw new Error("Open-Meteo response is missing current temperature");
      }

      const forecast: WeatherForecastPayload = {
        location: {
          ...request.location,
          timezone,
        },
        units: request.units,
        current: {
          temperature: current.temperature_2m,
          feelsLike:
            typeof current.apparent_temperature === "number"
              ? current.apparent_temperature
              : current.temperature_2m,
          humidity: nullableInt(current.relative_humidity_2m),
          windSpeed: nullableNumber(current.wind_speed_10m),
          precipitationProbability: nullableInt(current.precipitation_probability),
          condition: weatherConditionFromCode(weatherCode),
          observedAt: toIso(current.time, now),
        },
        hourly,
        daily,
        providerId: "open-meteo",
        fetchedAt: now.toISOString(),
        timezone,
      };

      return {
        forecast,
        cacheStatus: result.cacheStatus,
      };
    },
  };
}
