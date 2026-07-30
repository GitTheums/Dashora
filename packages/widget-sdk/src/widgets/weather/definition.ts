import { defineWidget } from "../../definition.js";
import { WEATHER_DEFAULT_CONFIG, weatherConfigSchema } from "./config.js";

export const WEATHER_WIDGET_ID = "weather" as const;

export const weatherDefinition = defineWidget({
  id: WEATHER_WIDGET_ID,
  name: "Weather",
  version: "1.0.0",
  schemaVersion: 1,
  description:
    "Current conditions with hourly and daily forecasts, metric or imperial units, and timezone-aware times.",
  category: "home",
  icon: { name: "cloud", label: "Weather" },
  configSchema: weatherConfigSchema,
  defaultConfig: WEATHER_DEFAULT_CONFIG,
  defaultLayout: {
    colSpan: 4,
    rowSpan: 3,
    minColSpan: 2,
    minRowSpan: 2,
    maxColSpan: 8,
    maxRowSpan: 8,
    tabletColSpan: 4,
    mobileColSpan: 4,
  },
  capabilities: {
    supportsManualRefresh: true,
    supportsTitleOverride: true,
    requiresIntegration: false,
    supportsDisable: true,
    hasSettings: true,
  },
  cache: {
    ttlSeconds: 600,
    staleWhileRevalidateSeconds: 1800,
    varyByConfig: true,
    varyByCredential: false,
  },
  refresh: {
    defaultIntervalSeconds: 600,
    minManualIntervalSeconds: 10,
  },
});
