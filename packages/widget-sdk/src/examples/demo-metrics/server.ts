/**
 * Server-safe demo-metrics exports (no React renderers).
 */
export {
  demoMetricsConfigSchema,
  DEMO_METRICS_DEFAULT_CONFIG,
  demoMetricsDataSchema,
  type DemoMetricsConfig,
  type DemoMetricsData,
} from "./config.js";
export {
  DEMO_METRICS_WIDGET_ID,
  demoMetricsDefinition,
  demoMetricsConfigMigration,
} from "./definition.js";
export {
  demoMetricsProvider,
  clearDemoMetricsCache,
} from "./provider.js";
