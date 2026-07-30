import { defineWidget } from "../../definition.js";
import { RSS_DEFAULT_CONFIG, rssConfigSchema } from "./config.js";

export const RSS_WIDGET_ID = "rss" as const;

export const rssDefinition = defineWidget({
  id: RSS_WIDGET_ID,
  name: "RSS",
  version: "1.0.0",
  schemaVersion: 1,
  description:
    "Aggregate multiple RSS and Atom feeds with safe text rendering, layouts, and per-feed failure isolation.",
  category: "media",
  icon: { name: "rss", label: "RSS" },
  configSchema: rssConfigSchema,
  defaultConfig: RSS_DEFAULT_CONFIG,
  defaultLayout: {
    colSpan: 6,
    rowSpan: 3,
    minColSpan: 3,
    minRowSpan: 2,
    maxColSpan: 12,
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
    ttlSeconds: 300,
    staleWhileRevalidateSeconds: 1200,
    varyByConfig: true,
    varyByCredential: false,
  },
  refresh: {
    defaultIntervalSeconds: 300,
    minManualIntervalSeconds: 10,
  },
});
