import type { WidgetCacheStatus } from "../../cache.js";
import type {
  WeatherCurrent,
  WeatherDailyPoint,
  WeatherHourlyPoint,
  WeatherLocation,
  WeatherLocationSearchResult,
  WeatherUnits,
} from "./config.js";

/**
 * Sanitized forecast payload returned by a weather provider adapter.
 * Layout / display flags are applied by the widget provider from config.
 */
export type WeatherForecastPayload = {
  location: WeatherLocation;
  units: WeatherUnits;
  current: WeatherCurrent;
  hourly: WeatherHourlyPoint[];
  daily: WeatherDailyPoint[];
  providerId: string;
  fetchedAt: string;
  timezone: string;
};

export type WeatherForecastRequest = {
  location: WeatherLocation;
  units: WeatherUnits;
  hourlyCount: number;
  dailyCount: number;
  signal?: AbortSignal;
  forceRefresh?: boolean;
  now?: Date;
};

export type WeatherForecastResult = {
  forecast: WeatherForecastPayload;
  cacheStatus: WidgetCacheStatus;
};

/**
 * Pluggable weather upstream. Production uses Open-Meteo; tests inject fakes.
 */
export type WeatherProviderAdapter = {
  readonly id: string;
  searchLocations: (
    query: string,
    options?: { signal?: AbortSignal; limit?: number },
  ) => Promise<WeatherLocationSearchResult[]>;
  fetchForecast: (request: WeatherForecastRequest) => Promise<WeatherForecastResult>;
};
