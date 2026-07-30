import { afterEach, describe, expect, it } from "vitest";
import { createWidgetDataResponse } from "../../envelope.js";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import {
  DEMO_METRICS_DEFAULT_CONFIG,
  clearDemoMetricsCache,
  demoMetricsConfigSchema,
  demoMetricsDefinition,
  demoMetricsProvider,
} from "./index.js";

describe("demo-metrics definition", () => {
  it("covers every required runtime state", () => {
    expect(demoMetricsDefinition.states).toEqual(REQUIRED_WIDGET_STATES);
    expect(demoMetricsDefinition.id).toBe("demo-metrics");
    expect(demoMetricsDefinition.capabilities.supportsManualRefresh).toBe(true);
    expect(demoMetricsDefinition.capabilities.supportsTitleOverride).toBe(true);
    expect(demoMetricsDefinition.capabilities.requiresIntegration).toBe(false);
  });

  it("parses default config", () => {
    expect(demoMetricsConfigSchema.parse({})).toEqual(DEMO_METRICS_DEFAULT_CONFIG);
  });
});

describe("demo-metrics provider", () => {
  afterEach(() => {
    clearDemoMetricsCache();
  });

  it("returns success data and caches subsequent hits", async () => {
    const first = await demoMetricsProvider.fetch({
      instanceId: "a",
      config: { ...DEMO_METRICS_DEFAULT_CONFIG, seedValue: 10 },
      now: () => new Date("2026-07-30T10:00:00.000Z"),
    });
    expect(first.state).toBe("success");
    expect(first.cacheStatus).toBe("miss");
    expect(first.data?.value).toBe(10);

    const second = await demoMetricsProvider.fetch({
      instanceId: "a",
      config: { ...DEMO_METRICS_DEFAULT_CONFIG, seedValue: 10 },
      now: () => new Date("2026-07-30T10:00:10.000Z"),
    });
    expect(second.state).toBe("success");
    expect(second.cacheStatus).toBe("hit");
  });

  it("returns stale after TTL within the SWR window", async () => {
    await demoMetricsProvider.fetch({
      instanceId: "b",
      config: { ...DEMO_METRICS_DEFAULT_CONFIG, seedValue: 7 },
      now: () => new Date("2026-07-30T10:00:00.000Z"),
    });

    const stale = await demoMetricsProvider.fetch({
      instanceId: "b",
      config: { ...DEMO_METRICS_DEFAULT_CONFIG, seedValue: 7 },
      now: () => new Date("2026-07-30T10:00:45.000Z"),
    });

    expect(stale.state).toBe("stale");
    expect(stale.cacheStatus).toBe("stale");
    expect(stale.data?.value).toBe(7);
  });

  it("returns empty when seedValue is 0", async () => {
    const result = await demoMetricsProvider.fetch({
      instanceId: "c",
      config: { ...DEMO_METRICS_DEFAULT_CONFIG, seedValue: 0 },
    });
    expect(result.state).toBe("empty");
  });

  it("returns disabled when enabled is false", async () => {
    const result = await demoMetricsProvider.fetch({
      instanceId: "d",
      config: { ...DEMO_METRICS_DEFAULT_CONFIG, enabled: false },
    });
    expect(result.state).toBe("disabled");
  });

  it.each(REQUIRED_WIDGET_STATES)("honors forceState=%s", async (forceState) => {
    const result = await demoMetricsProvider.fetch({
      instanceId: `force-${forceState}`,
      config: { ...DEMO_METRICS_DEFAULT_CONFIG, forceState },
    });
    expect(result.state).toBe(forceState);
  });

  it("builds a shared API envelope from a provider result", async () => {
    const result = await demoMetricsProvider.fetch({
      instanceId: "env-1",
      config: DEMO_METRICS_DEFAULT_CONFIG,
      now: () => new Date("2026-07-30T11:00:00.000Z"),
    });

    const envelope = createWidgetDataResponse({
      widgetId: demoMetricsDefinition.id,
      instanceId: "env-1",
      state: result.state,
      data: result.data,
      message: result.message,
      errorCode: result.errorCode,
      meta: {
        fetchedAt: "2026-07-30T11:00:00.000Z",
        cache: result.cacheStatus,
        schemaVersion: demoMetricsDefinition.schemaVersion,
        widgetVersion: demoMetricsDefinition.version,
      },
    });

    expect(envelope.widgetId).toBe("demo-metrics");
    expect(envelope.state).toBe("success");
  });
});
