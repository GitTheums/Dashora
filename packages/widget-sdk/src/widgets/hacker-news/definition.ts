import { defineWidget } from "../../definition.js";
import { HACKER_NEWS_DEFAULT_CONFIG, hackerNewsConfigSchema } from "./config.js";

export const HACKER_NEWS_WIDGET_ID = "hacker-news" as const;

export const hackerNewsDefinition = defineWidget({
  id: HACKER_NEWS_WIDGET_ID,
  name: "Hacker News",
  version: "1.0.0",
  schemaVersion: 1,
  description:
    "Top, new, best, Ask, Show, and Jobs stories from the official Hacker News Firebase API.",
  category: "media",
  icon: { name: "rss", label: "Hacker News" },
  configSchema: hackerNewsConfigSchema,
  defaultConfig: HACKER_NEWS_DEFAULT_CONFIG,
  defaultLayout: {
    colSpan: 4,
    rowSpan: 3,
    minColSpan: 3,
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
    ttlSeconds: 120,
    staleWhileRevalidateSeconds: 600,
    varyByConfig: true,
    varyByCredential: false,
  },
  refresh: {
    defaultIntervalSeconds: 180,
    minManualIntervalSeconds: 15,
  },
});
