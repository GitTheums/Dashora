import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineWidget } from "./definition.js";
import { REQUIRED_WIDGET_STATES, assertCoversRequiredStates, widgetStateSchema } from "./states.js";

describe("widgetStateSchema", () => {
  it("includes every required widget state", () => {
    expect(widgetStateSchema.options).toEqual([...REQUIRED_WIDGET_STATES]);
    expect(REQUIRED_WIDGET_STATES).toEqual(
      expect.arrayContaining([
        "loading",
        "refreshing",
        "success",
        "empty",
        "stale",
        "error",
        "disabled",
        "configuration-required",
      ]),
    );
  });
});

describe("assertCoversRequiredStates", () => {
  it("throws when a required state is missing", () => {
    expect(() => assertCoversRequiredStates(["loading", "success"], "sample")).toThrow(
      /missing required states/,
    );
  });

  it("accepts the full required set", () => {
    expect(() => assertCoversRequiredStates(REQUIRED_WIDGET_STATES)).not.toThrow();
  });
});

describe("defineWidget", () => {
  it("builds a metadata-valid definition with defaults", () => {
    const definition = defineWidget({
      id: "sample-clock",
      name: "Sample Clock",
      version: "0.1.0",
      schemaVersion: 1,
      description: "A minimal sample definition for contract tests.",
      category: "utilities",
      icon: { name: "clock" },
      configSchema: z.object({ timezone: z.string().default("UTC") }),
      defaultConfig: { timezone: "UTC" },
      capabilities: {
        supportsManualRefresh: false,
        supportsTitleOverride: true,
        requiresIntegration: false,
        hasSettings: false,
      },
    });

    expect(definition.id).toBe("sample-clock");
    expect(definition.states).toEqual(REQUIRED_WIDGET_STATES);
    expect(definition.defaultLayout.colSpan).toBe(4);
    expect(definition.capabilities.supportsManualRefresh).toBe(false);
    expect(definition.cache.ttlSeconds).toBe(60);
  });

  it("rejects incomplete state lists", () => {
    expect(() =>
      defineWidget({
        id: "broken",
        name: "Broken",
        version: "0.0.1",
        schemaVersion: 1,
        description: "Missing states on purpose.",
        category: "other",
        icon: { name: "x" },
        configSchema: z.object({}),
        defaultConfig: {},
        states: ["loading", "success"],
      }),
    ).toThrow(/missing required states/);
  });

  it("rejects migrateConfig.currentVersion mismatches", () => {
    expect(() =>
      defineWidget({
        id: "mismatch",
        name: "Mismatch",
        version: "0.0.1",
        schemaVersion: 2,
        description: "Migration version mismatch on purpose.",
        category: "other",
        icon: { name: "x" },
        configSchema: z.object({ title: z.string().default("x") }),
        defaultConfig: { title: "x" },
        migrateConfig: {
          currentVersion: 1,
          steps: [],
        },
      }),
    ).toThrow(/migrateConfig.currentVersion/);
  });
});
