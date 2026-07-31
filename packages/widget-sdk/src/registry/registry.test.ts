import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineWidget } from "../definition.js";
import { defineWidgetProvider } from "../provider.js";
import {
  createWidgetClientRegistry,
  createWidgetMetadataRegistry,
  createWidgetServerRegistry,
  toClientRegistration,
  toServerRegistration,
} from "./index.js";

const fixtureConfigSchema = z.object({
  title: z.string().trim().min(1).max(40).default("Fixture"),
  warningThreshold: z.number().int().min(0).max(10_000).default(80),
  enabled: z.boolean().default(true),
});

type FixtureConfig = z.infer<typeof fixtureConfigSchema>;

const fixtureDefinition = defineWidget({
  id: "registry-fixture",
  name: "Registry Fixture",
  version: "0.1.0",
  schemaVersion: 2,
  description: "Inline fixture used only by registry unit tests.",
  category: "utilities",
  icon: { name: "chart", label: "Fixture" },
  configSchema: fixtureConfigSchema,
  defaultConfig: fixtureConfigSchema.parse({}),
  capabilities: {
    supportsManualRefresh: true,
    supportsTitleOverride: true,
    requiresIntegration: false,
    supportsDisable: true,
    hasSettings: true,
  },
  migrateConfig: {
    currentVersion: 2,
    steps: [
      {
        fromVersion: 1,
        toVersion: 2,
        migrate: (config: unknown) => {
          const legacy = config as { title?: string; threshold?: number; enabled?: boolean };
          return {
            title: legacy.title ?? "Fixture",
            warningThreshold: legacy.threshold ?? 80,
            enabled: legacy.enabled ?? true,
          };
        },
      },
    ],
  },
});

const fixtureProvider = defineWidgetProvider<FixtureConfig, { ok: true }>({
  id: "registry-fixture",
  fetch: async () => ({ state: "success", data: { ok: true } }),
});

function FixtureRenderer() {
  return null;
}

function FixtureSettings() {
  return null;
}

describe("widget registries", () => {
  it("indexes metadata by id and category", () => {
    const registry = createWidgetMetadataRegistry([fixtureDefinition]);
    expect(registry.has("registry-fixture")).toBe(true);
    expect(registry.require("registry-fixture").name).toBe("Registry Fixture");
    expect(registry.getByCategory("utilities")).toHaveLength(1);
    expect(registry.ids()).toEqual(["registry-fixture"]);
  });

  it("rejects duplicate metadata ids", () => {
    expect(() => createWidgetMetadataRegistry([fixtureDefinition, fixtureDefinition])).toThrow(
      /Duplicate widget id/,
    );
  });

  it("parses and migrates config on the server registry", () => {
    const registry = createWidgetServerRegistry([
      toServerRegistration(fixtureDefinition, fixtureProvider),
    ]);

    const migrated = registry.parseConfig("registry-fixture", { title: "Jobs", threshold: 50 }, 1);

    expect(migrated).toMatchObject({
      title: "Jobs",
      warningThreshold: 50,
      enabled: true,
    });

    expect(registry.requireProvider("registry-fixture").id).toBe("registry-fixture");
  });

  it("registers renderer and settings on the client registry", () => {
    const registry = createWidgetClientRegistry([
      toClientRegistration(fixtureDefinition, FixtureRenderer, FixtureSettings),
    ]);

    expect(registry.requireRenderer("registry-fixture")).toBe(FixtureRenderer);
    expect(registry.getSettings("registry-fixture")).toBe(FixtureSettings);
  });

  it("requires Settings when hasSettings is true", () => {
    expect(() =>
      createWidgetClientRegistry([toClientRegistration(fixtureDefinition, FixtureRenderer)]),
    ).toThrow(/hasSettings/);
  });
});
