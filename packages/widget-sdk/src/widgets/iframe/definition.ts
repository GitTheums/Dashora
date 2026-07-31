import { defineWidget } from "../../definition.js";
import { IFRAME_DEFAULT_CONFIG, iframeConfigSchema } from "./config.js";

export const IFRAME_WIDGET_ID = "iframe" as const;

export const iframeDefinition = defineWidget({
  id: IFRAME_WIDGET_ID,
  name: "iFrame",
  version: "1.0.0",
  schemaVersion: 1,
  description:
    "Sandboxed https embed with optional host allow list and aspect ratio. Does not relax global CSP.",
  category: "utilities",
  icon: { name: "grid", label: "iFrame" },
  configSchema: iframeConfigSchema,
  defaultConfig: IFRAME_DEFAULT_CONFIG,
  defaultLayout: {
    colSpan: 6,
    rowSpan: 3,
    minColSpan: 3,
    minRowSpan: 2,
    maxColSpan: 12,
    maxRowSpan: 8,
    tabletColSpan: 6,
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
    staleWhileRevalidateSeconds: 900,
    varyByConfig: true,
    varyByCredential: false,
  },
  refresh: {
    defaultIntervalSeconds: 600,
    minManualIntervalSeconds: 30,
  },
});
