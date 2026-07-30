import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createWidgetDataResponse, widgetDataResponseSchema } from "./envelope.js";
import {
  WidgetConfigMigrationError,
  migrateWidgetConfig,
  parseMigratedConfig,
} from "./migration.js";

describe("widgetDataResponseSchema", () => {
  it("accepts a success envelope", () => {
    const response = createWidgetDataResponse({
      widgetId: "demo-metrics",
      instanceId: "inst-1",
      state: "success",
      data: { value: 12 },
      meta: {
        fetchedAt: "2026-07-30T09:00:00.000Z",
        expiresAt: "2026-07-30T09:00:30.000Z",
        cache: "hit",
        schemaVersion: 2,
        widgetVersion: "0.1.0",
      },
    });

    expect(response.state).toBe("success");
    expect(widgetDataResponseSchema.parse(response).data).toEqual({ value: 12 });
  });

  it("rejects invalid states", () => {
    expect(() =>
      widgetDataResponseSchema.parse({
        widgetId: "x",
        instanceId: "y",
        state: "ready",
        meta: {
          fetchedAt: "2026-07-30T09:00:00.000Z",
          schemaVersion: 1,
        },
      }),
    ).toThrow();
  });
});

describe("migrateWidgetConfig", () => {
  const steps = [
    {
      fromVersion: 1,
      toVersion: 2,
      migrate: (config: unknown) => {
        const legacy = config as { name?: string };
        return { title: legacy.name ?? "Untitled" };
      },
    },
  ];

  it("returns config unchanged when versions match", () => {
    expect(migrateWidgetConfig({ a: 1 }, 2, 2, steps)).toEqual({ a: 1 });
  });

  it("applies ordered steps", () => {
    expect(migrateWidgetConfig({ name: "Alpha" }, 1, 2, steps)).toEqual({
      title: "Alpha",
    });
  });

  it("throws when a step is missing", () => {
    expect(() => migrateWidgetConfig({}, 1, 3, steps)).toThrow(WidgetConfigMigrationError);
  });

  it("parseMigratedConfig validates after migration", () => {
    const schema = z.object({ title: z.string().min(1) });
    const parsed = parseMigratedConfig(schema, { name: "Beta" }, 1, { currentVersion: 2, steps });
    expect(parsed).toEqual({ title: "Beta" });
  });
});
