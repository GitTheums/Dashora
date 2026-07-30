import { defineWidget } from "../../definition.js";
import { CALENDAR_DEFAULT_CONFIG, calendarConfigSchema } from "./config.js";

export const CALENDAR_WIDGET_ID = "calendar" as const;

export const calendarDefinition = defineWidget({
  id: CALENDAR_WIDGET_ID,
  name: "Calendar",
  version: "1.0.0",
  schemaVersion: 1,
  description:
    "Privacy-conscious calendar from ICS feeds with day, agenda, and month-summary layouts. No Google or Microsoft OAuth.",
  category: "productivity",
  icon: { name: "calendar", label: "Calendar" },
  configSchema: calendarConfigSchema,
  defaultConfig: CALENDAR_DEFAULT_CONFIG,
  defaultLayout: {
    colSpan: 4,
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
    varyByCredential: true,
  },
  refresh: {
    defaultIntervalSeconds: 300,
    minManualIntervalSeconds: 15,
  },
});
