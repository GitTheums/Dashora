import { defineWidget } from "../../definition.js";
import { SEARCH_DEFAULT_CONFIG, searchConfigSchema } from "./config.js";

export const SEARCH_WIDGET_ID = "search" as const;

export const searchDefinition = defineWidget({
  id: SEARCH_WIDGET_ID,
  name: "Search",
  version: "1.0.0",
  schemaVersion: 1,
  description: "Configurable web search with a keyboard shortcut and optional quick links.",
  category: "utilities",
  icon: { name: "search", label: "Search" },
  configSchema: searchConfigSchema,
  defaultConfig: SEARCH_DEFAULT_CONFIG,
  defaultLayout: {
    colSpan: 6,
    rowSpan: 2,
    minColSpan: 3,
    minRowSpan: 1,
    maxColSpan: 12,
    maxRowSpan: 3,
    tabletColSpan: 8,
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
    ttlSeconds: 86_400,
    staleWhileRevalidateSeconds: 0,
    varyByConfig: true,
    varyByCredential: false,
  },
  refresh: {
    defaultIntervalSeconds: 86_400,
    minManualIntervalSeconds: 5,
  },
});
