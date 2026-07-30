import { defineWidget } from "../../definition.js";
import { BOOKMARKS_DEFAULT_CONFIG, bookmarksConfigSchema } from "./config.js";

export const BOOKMARKS_WIDGET_ID = "bookmarks" as const;

export const bookmarksDefinition = defineWidget({
  id: BOOKMARKS_WIDGET_ID,
  name: "Bookmarks",
  version: "1.0.0",
  schemaVersion: 1,
  description: "Grouped bookmarks with icons, descriptions, and design-token colors.",
  category: "utilities",
  icon: { name: "bookmark", label: "Bookmarks" },
  configSchema: bookmarksConfigSchema,
  defaultConfig: BOOKMARKS_DEFAULT_CONFIG,
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
