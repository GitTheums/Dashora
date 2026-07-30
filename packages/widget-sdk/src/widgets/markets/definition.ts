import { defineWidget } from "../../definition.js";
import { MARKETS_DEFAULT_CONFIG, marketsConfigSchema } from "./config.js";

export const MARKETS_WIDGET_ID = "markets" as const;

export const marketsDefinition = defineWidget({
  id: MARKETS_WIDGET_ID,
  name: "Markets",
  version: "1.0.0",
  schemaVersion: 1,
  description:
    "Watchlist of crypto, equities, and indexes with price, change, sparklines, and market status.",
  category: "finance",
  icon: { name: "chart", label: "Markets" },
  configSchema: marketsConfigSchema,
  defaultConfig: MARKETS_DEFAULT_CONFIG,
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
    varyByCredential: false,
  },
  refresh: {
    defaultIntervalSeconds: 60,
    minManualIntervalSeconds: 10,
  },
});
