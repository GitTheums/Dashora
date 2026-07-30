import { defineWidget } from "../../definition.js";
import { CLOCK_DEFAULT_CONFIG, clockConfigSchema } from "./config.js";

export const CLOCK_WIDGET_ID = "clock" as const;

export const clockDefinition = defineWidget({
  id: CLOCK_WIDGET_ID,
  name: "Clock",
  version: "1.0.0",
  schemaVersion: 1,
  description: "Local or remote timezone clock with optional secondary zone and date.",
  category: "utilities",
  icon: { name: "clock", label: "Clock" },
  configSchema: clockConfigSchema,
  defaultConfig: CLOCK_DEFAULT_CONFIG,
  defaultLayout: {
    colSpan: 3,
    rowSpan: 2,
    minColSpan: 2,
    minRowSpan: 1,
    maxColSpan: 6,
    maxRowSpan: 3,
    tabletColSpan: 4,
    mobileColSpan: 4,
  },
  capabilities: {
    supportsManualRefresh: false,
    supportsTitleOverride: true,
    requiresIntegration: false,
    supportsDisable: true,
    hasSettings: true,
  },
  cache: {
    ttlSeconds: 1,
    staleWhileRevalidateSeconds: 0,
    varyByConfig: true,
    varyByCredential: false,
  },
  refresh: {
    defaultIntervalSeconds: 30,
    minManualIntervalSeconds: 1,
  },
});
