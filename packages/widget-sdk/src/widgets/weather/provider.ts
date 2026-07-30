import { defineWidgetProvider } from "../../provider.js";
import type { WeatherProviderAdapter } from "./adapter.js";
import {
  type WeatherConfig,
  type WeatherData,
  weatherConfigSchema,
  weatherDataSchema,
} from "./config.js";
import { WEATHER_WIDGET_ID } from "./definition.js";

export type WeatherProviderDeps = {
  adapter: WeatherProviderAdapter;
};

export function createWeatherProvider(deps: WeatherProviderDeps) {
  return defineWidgetProvider<WeatherConfig, WeatherData>({
    id: WEATHER_WIDGET_ID,
    fetch: async (ctx) => {
      const config = weatherConfigSchema.parse(ctx.config);

      if (!config.enabled) {
        return { state: "disabled", message: "Weather is disabled in settings." };
      }

      if (!config.location) {
        return {
          state: "configuration-required",
          message: "Search for a location in settings to show the forecast.",
        };
      }

      try {
        const result = await deps.adapter.fetchForecast({
          location: config.location,
          units: config.units,
          hourlyCount: config.hourlyCount,
          dailyCount: config.dailyCount,
          ...(ctx.signal ? { signal: ctx.signal } : {}),
          ...(ctx.forceRefresh !== undefined ? { forceRefresh: ctx.forceRefresh } : {}),
          ...(ctx.now ? { now: ctx.now() } : {}),
        });

        const hourly = config.showHourly ? result.forecast.hourly.slice(0, config.hourlyCount) : [];
        const daily = config.showDaily ? result.forecast.daily.slice(0, config.dailyCount) : [];

        const data = weatherDataSchema.parse({
          location: result.forecast.location,
          units: config.units,
          layout: config.layout,
          showHourly: config.showHourly,
          showDaily: config.showDaily,
          current: result.forecast.current,
          hourly,
          daily,
          providerId: result.forecast.providerId,
          fetchedAt: result.forecast.fetchedAt,
          timezone: result.forecast.timezone,
        });

        if (result.cacheStatus === "stale") {
          return {
            state: "stale",
            data,
            message: "Showing last good forecast while a refresh is due.",
            cacheStatus: "stale",
          };
        }

        if (ctx.forceRefresh) {
          return {
            state: "refreshing",
            data,
            message: "Refreshing forecast…",
            cacheStatus: result.cacheStatus,
          };
        }

        return {
          state: "success",
          data,
          cacheStatus: result.cacheStatus,
        };
      } catch {
        return {
          state: "error",
          message: "Could not load the weather forecast.",
          errorCode: "weather_fetch_failed",
        };
      }
    },
  });
}
