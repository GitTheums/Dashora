import { defineWidget } from "../../definition.js";
import { CUSTOM_API_DEFAULT_CONFIG, customApiConfigSchema } from "./config.js";

export const CUSTOM_API_WIDGET_ID = "custom-api" as const;

export const customApiDefinition = defineWidget({
  id: CUSTOM_API_WIDGET_ID,
  name: "Custom API",
  version: "1.0.0",
  schemaVersion: 1,
  description:
    "Server-side GET/POST against a JSON API with secret-backed headers and safe presentation templates.",
  category: "utilities",
  icon: { name: "grid", label: "Custom API" },
  configSchema: customApiConfigSchema,
  defaultConfig: CUSTOM_API_DEFAULT_CONFIG,
  defaultLayout: {
    colSpan: 4,
    rowSpan: 2,
    minColSpan: 2,
    minRowSpan: 1,
    maxColSpan: 8,
    maxRowSpan: 6,
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
    ttlSeconds: 60,
    staleWhileRevalidateSeconds: 300,
    varyByConfig: true,
    varyByCredential: true,
  },
  refresh: {
    defaultIntervalSeconds: 120,
    minManualIntervalSeconds: 15,
  },
});
