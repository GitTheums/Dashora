import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineWidget } from "../definition.js";
import { defineWidgetProvider } from "../provider.js";
import {
  asTypedProvider,
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

const plainDefinition = defineWidget({
  id: "registry-plain",
  name: "Plain Fixture",
  version: "0.1.0",
  schemaVersion: 1,
  description: "Fixture without migration used by registry unit tests.",
  category: "utilities",
  icon: { name: "chart", label: "Plain" },
  configSchema: fixtureConfigSchema,
  defaultConfig: fixtureConfigSchema.parse({}),
  capabilities: {
    supportsManualRefresh: false,
    supportsTitleOverride: true,
    requiresIntegration: false,
    supportsDisable: true,
    hasSettings: false,
  },
});

const fixtureProvider = defineWidgetProvider<FixtureConfig, { ok: true }>({
  id: "registry-fixture",
  fetch: async () => ({ state: "success", data: { ok: true } }),
});

const plainProvider = defineWidgetProvider<FixtureConfig, { ok: true }>({
  id: "registry-plain",
  fetch: async () => ({ state: "success", data: { ok: true } }),
});

const mismatchedProvider = defineWidgetProvider<FixtureConfig, { ok: true }>({
  id: "other-id",
  fetch: async () => ({ state: "success", data: { ok: true } }),
});

function FixtureRenderer() {
  return null;
}

function FixtureSettings() {
  return null;
}

function PlainRenderer() {
  return null;
}

describe("widget metadata registry", () => {
  it("indexes metadata by id and category", () => {
    const registry = createWidgetMetadataRegistry([fixtureDefinition, plainDefinition]);
    expect(registry.has("registry-fixture")).toBe(true);
    expect(registry.get("registry-fixture")?.name).toBe("Registry Fixture");
    expect(registry.require("registry-fixture").name).toBe("Registry Fixture");
    expect(
      registry
        .getByCategory("utilities")
        .map((entry) => entry.id)
        .sort(),
    ).toEqual(["registry-fixture", "registry-plain"]);
    expect(registry.getByCategory("media")).toEqual([]);
    expect(registry.ids()).toEqual(["registry-fixture", "registry-plain"]);
    expect(registry.list().map((entry) => entry.name)).toEqual([
      "Plain Fixture",
      "Registry Fixture",
    ]);
  });

  it("rejects duplicate metadata ids", () => {
    expect(() => createWidgetMetadataRegistry([fixtureDefinition, fixtureDefinition])).toThrow(
      /Duplicate widget id/,
    );
  });

  it("throws for unknown metadata ids", () => {
    const registry = createWidgetMetadataRegistry([fixtureDefinition]);
    expect(registry.get("missing")).toBeUndefined();
    expect(registry.has("missing")).toBe(false);
    expect(() => registry.require("missing")).toThrow(/Unknown widget id/);
  });
});

describe("widget client registry", () => {
  it("registers renderer and optional settings", () => {
    const registry = createWidgetClientRegistry([
      toClientRegistration(fixtureDefinition, FixtureRenderer, FixtureSettings),
      toClientRegistration(plainDefinition, PlainRenderer),
    ]);

    expect(registry.has("registry-fixture")).toBe(true);
    expect(registry.has("missing")).toBe(false);
    expect(registry.getDefinition("registry-fixture")).toBe(fixtureDefinition);
    expect(registry.requireDefinition("registry-fixture")).toBe(fixtureDefinition);
    expect(registry.getRenderer("registry-fixture")).toBe(FixtureRenderer);
    expect(registry.requireRenderer("registry-fixture")).toBe(FixtureRenderer);
    expect(registry.getSettings("registry-fixture")).toBe(FixtureSettings);
    expect(registry.getSettings("registry-plain")).toBeUndefined();
    expect(registry.ids()).toEqual(["registry-fixture", "registry-plain"]);
  });

  it("rejects duplicate client registrations", () => {
    expect(() =>
      createWidgetClientRegistry([
        toClientRegistration(fixtureDefinition, FixtureRenderer, FixtureSettings),
        toClientRegistration(fixtureDefinition, FixtureRenderer, FixtureSettings),
      ]),
    ).toThrow(/Duplicate widget id in client registry/);
  });

  it("requires Settings when hasSettings is true", () => {
    expect(() =>
      createWidgetClientRegistry([toClientRegistration(fixtureDefinition, FixtureRenderer)]),
    ).toThrow(/hasSettings/);
  });

  it("throws for unknown client lookups", () => {
    const registry = createWidgetClientRegistry([
      toClientRegistration(plainDefinition, PlainRenderer),
    ]);
    expect(registry.getDefinition("missing")).toBeUndefined();
    expect(registry.getRenderer("missing")).toBeUndefined();
    expect(() => registry.requireDefinition("missing")).toThrow(/Unknown widget id/);
    expect(() => registry.requireRenderer("missing")).toThrow(/No renderer registered/);
  });
});

describe("widget server registry", () => {
  it("registers providers and migrates config", async () => {
    const registry = createWidgetServerRegistry([
      toServerRegistration(fixtureDefinition, fixtureProvider),
      toServerRegistration(plainDefinition, plainProvider),
    ]);

    expect(registry.has("registry-fixture")).toBe(true);
    expect(registry.getDefinition("registry-fixture")).toBe(fixtureDefinition);
    expect(registry.requireDefinition("registry-fixture")).toBe(fixtureDefinition);
    expect(registry.getProvider("registry-fixture")?.id).toBe("registry-fixture");
    expect(registry.requireProvider("registry-fixture").id).toBe("registry-fixture");
    expect(registry.ids()).toEqual(["registry-fixture", "registry-plain"]);

    const migrated = registry.parseConfig("registry-fixture", { title: "Jobs", threshold: 50 }, 1);
    expect(migrated).toMatchObject({
      title: "Jobs",
      warningThreshold: 50,
      enabled: true,
    });

    const typed = asTypedProvider<FixtureConfig, { ok: true }>(
      registry.requireProvider("registry-fixture"),
    );
    const result = await typed.fetch({
      instanceId: "inst-1",
      config: fixtureConfigSchema.parse({ title: "Jobs" }),
    });
    expect(result).toEqual({ state: "success", data: { ok: true } });
  });

  it("parses config without migration when versions match", () => {
    const registry = createWidgetServerRegistry([
      toServerRegistration(plainDefinition, plainProvider),
    ]);
    expect(registry.parseConfig("registry-plain", { title: "Plain" }, 1)).toMatchObject({
      title: "Plain",
      enabled: true,
    });
  });

  it("rejects missing migration paths and unknown widgets", () => {
    const registry = createWidgetServerRegistry([
      toServerRegistration(plainDefinition, plainProvider),
    ]);
    expect(() => registry.parseConfig("registry-plain", { title: "Plain" }, 2)).toThrow(
      /has no migration from schema v2/,
    );
    expect(() => registry.parseConfig("missing", {}, 1)).toThrow(/Unknown widget id/);
    expect(() => registry.requireDefinition("missing")).toThrow(/Unknown widget id/);
    expect(() => registry.requireProvider("missing")).toThrow(/No provider registered/);
    expect(registry.getProvider("missing")).toBeUndefined();
    expect(registry.getDefinition("missing")).toBeUndefined();
    expect(registry.has("missing")).toBe(false);
  });

  it("rejects duplicate ids and provider/definition mismatches", () => {
    expect(() =>
      createWidgetServerRegistry([
        toServerRegistration(fixtureDefinition, fixtureProvider),
        toServerRegistration(fixtureDefinition, fixtureProvider),
      ]),
    ).toThrow(/Duplicate widget id in server registry/);

    expect(() =>
      createWidgetServerRegistry([toServerRegistration(fixtureDefinition, mismatchedProvider)]),
    ).toThrow(/does not match definition id/);
  });

  it("rejects invalid config after migration", () => {
    const registry = createWidgetServerRegistry([
      toServerRegistration(fixtureDefinition, fixtureProvider),
    ]);
    expect(() =>
      registry.parseConfig("registry-fixture", { title: "", threshold: 50 }, 1),
    ).toThrow();
  });
});
