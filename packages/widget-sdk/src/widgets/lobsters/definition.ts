import { defineWidget } from "../../definition.js";
import { LOBSTERS_DEFAULT_CONFIG, lobstersConfigSchema } from "./config.js";

export const LOBSTERS_WIDGET_ID = "lobsters" as const;

export const lobstersDefinition = defineWidget({
  id: LOBSTERS_WIDGET_ID,
  name: "Lobsters",
  version: "1.0.0",
  schemaVersion: 1,
  description:
    "Stories from Lobsters (lobste.rs) via official JSON feeds — hottest, newest, active, and tag filters.",
  category: "media",
  icon: { name: "rss", label: "Lobsters" },
  configSchema: lobstersConfigSchema,
  defaultConfig: LOBSTERS_DEFAULT_CONFIG,
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
