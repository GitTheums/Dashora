import { z } from "zod";

export const weatherUnitsSchema = z.enum(["metric", "imperial"]);
export type WeatherUnits = z.infer<typeof weatherUnitsSchema>;

export const weatherLayoutSchema = z.enum(["compact", "detailed"]);
export type WeatherLayout = z.infer<typeof weatherLayoutSchema>;

export const weatherLocationSchema = z.object({
  name: z.string().trim().min(1).max(120),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().trim().min(1).max(80).nullable().optional().default(null),
  country: z.string().trim().max(80).nullable().optional().default(null),
  admin1: z.string().trim().max(80).nullable().optional().default(null),
});

export type WeatherLocation = z.infer<typeof weatherLocationSchema>;

export const weatherConfigSchema = z.object({
  location: weatherLocationSchema.nullable().default(null),
  units: weatherUnitsSchema.default("metric"),
  layout: weatherLayoutSchema.default("detailed"),
  showHourly: z.boolean().default(true),
  showDaily: z.boolean().default(true),
  hourlyCount: z.number().int().min(1).max(24).default(12),
  dailyCount: z.number().int().min(1).max(14).default(7),
  enabled: z.boolean().default(true),
});

export type WeatherConfig = z.infer<typeof weatherConfigSchema>;

export const WEATHER_DEFAULT_CONFIG: WeatherConfig = weatherConfigSchema.parse({});

export const weatherConditionSchema = z.object({
  code: z.number().int(),
  label: z.string().min(1).max(80),
});

export type WeatherCondition = z.infer<typeof weatherConditionSchema>;

export const weatherCurrentSchema = z.object({
  temperature: z.number(),
  feelsLike: z.number(),
  humidity: z.number().int().min(0).max(100).nullable(),
  windSpeed: z.number().nullable(),
  precipitationProbability: z.number().int().min(0).max(100).nullable(),
  condition: weatherConditionSchema,
  observedAt: z.string().datetime({ offset: true }),
});

export type WeatherCurrent = z.infer<typeof weatherCurrentSchema>;

export const weatherHourlyPointSchema = z.object({
  time: z.string().datetime({ offset: true }),
  temperature: z.number(),
  precipitationProbability: z.number().int().min(0).max(100).nullable(),
  condition: weatherConditionSchema,
});

export type WeatherHourlyPoint = z.infer<typeof weatherHourlyPointSchema>;

export const weatherDailyPointSchema = z.object({
  date: z.string().min(8).max(32),
  tempMax: z.number(),
  tempMin: z.number(),
  precipitationProbabilityMax: z.number().int().min(0).max(100).nullable(),
  condition: weatherConditionSchema,
});

export type WeatherDailyPoint = z.infer<typeof weatherDailyPointSchema>;

export const weatherDataSchema = z.object({
  location: weatherLocationSchema,
  units: weatherUnitsSchema,
  layout: weatherLayoutSchema,
  showHourly: z.boolean(),
  showDaily: z.boolean(),
  current: weatherCurrentSchema,
  hourly: z.array(weatherHourlyPointSchema).max(24),
  daily: z.array(weatherDailyPointSchema).max(14),
  providerId: z.string().min(1).max(64),
  fetchedAt: z.string().datetime({ offset: true }),
  timezone: z.string().min(1).max(80),
});

export type WeatherData = z.infer<typeof weatherDataSchema>;

export const weatherLocationSearchResultSchema = weatherLocationSchema.extend({
  id: z.string().min(1).max(64).optional(),
});

export type WeatherLocationSearchResult = z.infer<typeof weatherLocationSearchResultSchema>;

export const weatherLocationSearchResponseSchema = z.object({
  results: z.array(weatherLocationSearchResultSchema).max(20),
});

export type WeatherLocationSearchResponse = z.infer<typeof weatherLocationSearchResponseSchema>;

export function temperatureUnitLabel(units: WeatherUnits): string {
  return units === "metric" ? "°C" : "°F";
}

export function windSpeedUnitLabel(units: WeatherUnits): string {
  return units === "metric" ? "km/h" : "mph";
}
