import { defineWidget } from "../../definition.js";
import { YOUTUBE_DEFAULT_CONFIG, youtubeConfigSchema } from "./config.js";

export const YOUTUBE_WIDGET_ID = "youtube" as const;

export const youtubeDefinition = defineWidget({
  id: YOUTUBE_WIDGET_ID,
  name: "YouTube uploads",
  version: "1.0.0",
  schemaVersion: 1,
  description:
    "Latest uploads from configured YouTube channels via the official Atom feed. No API key required.",
  category: "media",
  icon: { name: "rss", label: "YouTube" },
  configSchema: youtubeConfigSchema,
  defaultConfig: YOUTUBE_DEFAULT_CONFIG,
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
    minManualIntervalSeconds: 15,
  },
});
