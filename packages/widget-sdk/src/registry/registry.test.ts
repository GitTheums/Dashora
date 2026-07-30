import { describe, expect, it } from "vitest";
import {
  DemoMetricsRenderer,
  DemoMetricsSettings,
  demoMetricsDefinition,
  demoMetricsProvider,
} from "../examples/demo-metrics/index.js";
import {
  createWidgetClientRegistry,
  createWidgetMetadataRegistry,
  createWidgetServerRegistry,
  toClientRegistration,
  toServerRegistration,
} from "./index.js";

describe("widget registries", () => {
  it("indexes metadata by id and category", () => {
    const registry = createWidgetMetadataRegistry([demoMetricsDefinition]);
    expect(registry.has("demo-metrics")).toBe(true);
    expect(registry.require("demo-metrics").name).toBe("Demo Metrics");
    expect(registry.getByCategory("demo")).toHaveLength(1);
    expect(registry.ids()).toEqual(["demo-metrics"]);
  });

  it("rejects duplicate metadata ids", () => {
    expect(() =>
      createWidgetMetadataRegistry([demoMetricsDefinition, demoMetricsDefinition]),
    ).toThrow(/Duplicate widget id/);
  });

  it("parses and migrates config on the server registry", () => {
    const registry = createWidgetServerRegistry([
      toServerRegistration(demoMetricsDefinition, demoMetricsProvider),
    ]);

    const migrated = registry.parseConfig(
      "demo-metrics",
      { metricLabel: "Jobs", threshold: 50, seedValue: 3 },
      1,
    );

    expect(migrated).toMatchObject({
      metricLabel: "Jobs",
      warningThreshold: 50,
      enabled: true,
      seedValue: 3,
    });

    expect(registry.requireProvider("demo-metrics").id).toBe("demo-metrics");
  });

  it("registers renderer and settings on the client registry", () => {
    const registry = createWidgetClientRegistry([
      toClientRegistration(demoMetricsDefinition, DemoMetricsRenderer, DemoMetricsSettings),
    ]);

    expect(registry.requireRenderer("demo-metrics")).toBe(DemoMetricsRenderer);
    expect(registry.getSettings("demo-metrics")).toBe(DemoMetricsSettings);
  });

  it("requires Settings when hasSettings is true", () => {
    expect(() =>
      createWidgetClientRegistry([
        toClientRegistration(demoMetricsDefinition, DemoMetricsRenderer),
      ]),
    ).toThrow(/hasSettings/);
  });
});
