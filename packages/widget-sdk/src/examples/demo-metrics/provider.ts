import type { WidgetCacheStatus } from "../../cache.js";
import { defineWidgetProvider } from "../../provider.js";
import type { WidgetProviderResult } from "../../provider.js";
import type { WidgetState } from "../../states.js";
import { type DemoMetricsConfig, type DemoMetricsData, demoMetricsConfigSchema } from "./config.js";
import { DEMO_METRICS_WIDGET_ID } from "./definition.js";

type CacheEntry = {
  data: DemoMetricsData;
  storedAtMs: number;
  configKey: string;
};

/** Process-local demo cache — production widgets use the server cache store. */
const demoCache = new Map<string, CacheEntry>();

export function clearDemoMetricsCache(): void {
  demoCache.clear();
}

function configKey(config: DemoMetricsConfig): string {
  return JSON.stringify({
    metricLabel: config.metricLabel,
    warningThreshold: config.warningThreshold,
    seedValue: config.seedValue,
    forceState: config.forceState ?? null,
    enabled: config.enabled,
  });
}

function buildData(config: DemoMetricsConfig, now: Date): DemoMetricsData {
  return {
    label: config.metricLabel,
    value: config.seedValue,
    warningThreshold: config.warningThreshold,
    unit: "count",
    generatedAt: now.toISOString(),
  };
}

function forcedResult(
  state: WidgetState,
  config: DemoMetricsConfig,
  now: Date,
): WidgetProviderResult<DemoMetricsData> {
  switch (state) {
    case "loading":
      return { state: "loading", message: "Loading demo metrics…" };
    case "refreshing": {
      const data = buildData(config, now);
      return {
        state: "refreshing",
        data,
        message: "Refreshing demo metrics…",
        cacheStatus: "hit",
      };
    }
    case "success":
      return {
        state: "success",
        data: buildData(config, now),
        cacheStatus: "miss",
      };
    case "empty":
      return {
        state: "empty",
        message: "No demo metrics are available for this configuration.",
      };
    case "stale":
      return {
        state: "stale",
        data: buildData(config, new Date(now.getTime() - 60_000)),
        message: "Showing cached demo metrics while a refresh is due.",
        cacheStatus: "stale",
      };
    case "error":
      return {
        state: "error",
        message: "Demo metrics provider failed on purpose.",
        errorCode: "demo_metrics_forced_error",
      };
    case "disabled":
      return {
        state: "disabled",
        message: "Demo metrics is disabled.",
      };
    case "configuration-required":
      return {
        state: "configuration-required",
        message: "Set a metric label in settings to run this demo widget.",
      };
  }
}

/**
 * Server-side demo provider with a tiny in-memory TTL cache to illustrate SWR.
 */
export const demoMetricsProvider = defineWidgetProvider<DemoMetricsConfig, DemoMetricsData>({
  id: DEMO_METRICS_WIDGET_ID,
  fetch: async (ctx) => {
    const config = demoMetricsConfigSchema.parse(ctx.config);
    const now = ctx.now?.() ?? new Date();
    const nowMs = now.getTime();
    const key = `${ctx.instanceId}:${configKey(config)}`;
    const ttlMs = 30_000;
    const staleWindowMs = 120_000;

    if (config.forceState) {
      return forcedResult(config.forceState, config, now);
    }

    if (!config.enabled) {
      return {
        state: "disabled",
        message: "Demo metrics is disabled in settings.",
      };
    }

    if (!config.metricLabel.trim()) {
      return {
        state: "configuration-required",
        message: "A metric label is required.",
      };
    }

    const existing = demoCache.get(key);
    const ageMs = existing ? nowMs - existing.storedAtMs : Number.POSITIVE_INFINITY;
    const fresh = existing && ageMs <= ttlMs;
    const staleButUsable = existing && ageMs <= ttlMs + staleWindowMs;

    if (!ctx.forceRefresh && fresh && existing) {
      return {
        state: "success",
        data: existing.data,
        cacheStatus: "hit" satisfies WidgetCacheStatus,
      };
    }

    if (!ctx.forceRefresh && staleButUsable && existing && !fresh) {
      // Soft revalidate: return stale immediately; a real server would refresh async.
      const refreshed = buildData(config, now);
      demoCache.set(key, {
        data: refreshed,
        storedAtMs: nowMs,
        configKey: configKey(config),
      });
      return {
        state: "stale",
        data: existing.data,
        message: "Serving last-good demo metrics while revalidating.",
        cacheStatus: "stale",
      };
    }

    // Simulate empty when seed is explicitly 0 and not forcing another state.
    if (config.seedValue === 0) {
      demoCache.delete(key);
      return {
        state: "empty",
        message: "Metric value is zero — nothing to chart in this demo.",
        cacheStatus: "miss",
      };
    }

    const data = buildData(config, now);
    demoCache.set(key, {
      data,
      storedAtMs: nowMs,
      configKey: configKey(config),
    });

    return {
      state: ctx.forceRefresh && existing ? "refreshing" : "success",
      data,
      cacheStatus: existing ? "bypass" : "miss",
    };
  },
});
