import { defineWidget } from "../../definition.js";
import { TWITCH_DEFAULT_CONFIG, twitchConfigSchema } from "./config.js";

export const TWITCH_WIDGET_ID = "twitch" as const;

export const twitchDefinition = defineWidget({
  id: TWITCH_WIDGET_ID,
  name: "Twitch channels",
  version: "1.0.0",
  schemaVersion: 1,
  description:
    "Live status and viewer counts for configured Twitch channels via the official Helix API.",
  category: "media",
  icon: { name: "rss", label: "Twitch" },
  configSchema: twitchConfigSchema,
  defaultConfig: TWITCH_DEFAULT_CONFIG,
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
    requiresIntegration: true,
    supportsDisable: true,
    hasSettings: true,
  },
  cache: {
    ttlSeconds: 60,
    staleWhileRevalidateSeconds: 120,
    varyByConfig: true,
    varyByCredential: true,
  },
  refresh: {
    defaultIntervalSeconds: 120,
    minManualIntervalSeconds: 15,
  },
});
