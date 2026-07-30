import { z } from "zod";

/**
 * Demo metrics config — intentionally small so contributors can copy the pattern.
 * `forceState` lets developers preview every visual state without mocking the network.
 */
export const demoMetricsConfigSchema = z.object({
  /** Display label for the primary metric. */
  metricLabel: z.string().trim().min(1).max(40).default("Active sessions"),
  /** Threshold used to tint the value (warning when value >= threshold). */
  warningThreshold: z.number().int().min(0).max(1_000_000).default(80),
  /** When false, the provider returns `disabled`. */
  enabled: z.boolean().default(true),
  /**
   * Optional override so the demo can exercise every runtime state.
   * Leave unset for normal success / empty / stale cache behavior.
   */
  forceState: z
    .enum([
      "loading",
      "refreshing",
      "success",
      "empty",
      "stale",
      "error",
      "disabled",
      "configuration-required",
    ])
    .optional(),
  /** Simulated base metric value when not forcing a state. */
  seedValue: z.number().int().min(0).max(10_000).default(42),
});

export type DemoMetricsConfig = z.infer<typeof demoMetricsConfigSchema>;

export const DEMO_METRICS_DEFAULT_CONFIG: DemoMetricsConfig = demoMetricsConfigSchema.parse({});

export const demoMetricsDataSchema = z.object({
  label: z.string().min(1),
  value: z.number().int().min(0),
  warningThreshold: z.number().int().min(0),
  unit: z.literal("count"),
  generatedAt: z.string().datetime({ offset: true }),
});

export type DemoMetricsData = z.infer<typeof demoMetricsDataSchema>;
