import { defineWidget } from "../../definition.js";
import { REDDIT_DEFAULT_CONFIG, redditConfigSchema } from "./config.js";

export const REDDIT_WIDGET_ID = "reddit" as const;

export const redditDefinition = defineWidget({
  id: REDDIT_WIDGET_ID,
  name: "Reddit",
  version: "1.0.0",
  schemaVersion: 1,
  description:
    "Posts from configured subreddits via the official Reddit OAuth API, with per-subreddit failure isolation.",
  category: "media",
  icon: { name: "rss", label: "Reddit" },
  configSchema: redditConfigSchema,
  defaultConfig: REDDIT_DEFAULT_CONFIG,
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
