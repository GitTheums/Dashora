import { defineWidget } from "../../definition.js";
import type { WidgetConfigMigration } from "../../migration.js";
import { DEMO_METRICS_DEFAULT_CONFIG, demoMetricsConfigSchema } from "./config.js";

export const DEMO_METRICS_WIDGET_ID = "demo-metrics" as const;

/**
 * v1 → v2: renamed `threshold` to `warningThreshold` and added `enabled`.
 */
export const demoMetricsConfigMigration: WidgetConfigMigration = {
  currentVersion: 2,
  steps: [
    {
      fromVersion: 1,
      toVersion: 2,
      migrate: (raw) => {
        const legacy = (raw ?? {}) as {
          metricLabel?: string;
          threshold?: number;
          seedValue?: number;
          forceState?: string;
        };
        return {
          metricLabel: legacy.metricLabel ?? "Active sessions",
          warningThreshold: legacy.threshold ?? 80,
          enabled: true,
          seedValue: legacy.seedValue ?? 42,
          ...(legacy.forceState ? { forceState: legacy.forceState } : {}),
        };
      },
    },
  ],
};

export const demoMetricsDefinition = defineWidget({
  id: DEMO_METRICS_WIDGET_ID,
  name: "Demo Metrics",
  version: "0.1.0",
  schemaVersion: 2,
  description:
    "Developer example widget that demonstrates settings, server fetch, cache behavior, and every runtime state.",
  category: "demo",
  icon: { name: "chart", label: "Demo metrics" },
  configSchema: demoMetricsConfigSchema,
  defaultConfig: DEMO_METRICS_DEFAULT_CONFIG,
  defaultLayout: {
    colSpan: 4,
    rowSpan: 2,
    minColSpan: 2,
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
    ttlSeconds: 30,
    staleWhileRevalidateSeconds: 120,
    varyByConfig: true,
    varyByCredential: false,
  },
  refresh: {
    defaultIntervalSeconds: 30,
    minManualIntervalSeconds: 3,
  },
  migrateConfig: demoMetricsConfigMigration,
});
