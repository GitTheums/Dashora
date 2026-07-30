import type { AnyWidgetDefinition } from "../definition.js";
import { parseMigratedConfig } from "../migration.js";
import type {
  AnyWidgetProvider,
  WidgetProvider,
  WidgetProviderContext,
  WidgetProviderResult,
} from "../provider.js";

export type WidgetServerRegistry = {
  getDefinition: (id: string) => AnyWidgetDefinition | undefined;
  requireDefinition: (id: string) => AnyWidgetDefinition;
  getProvider: (id: string) => AnyWidgetProvider | undefined;
  requireProvider: (id: string) => AnyWidgetProvider;
  has: (id: string) => boolean;
  ids: () => string[];
  /**
   * Migrates and validates stored config for a widget id.
   * When no migration is declared, `storedSchemaVersion` must already match.
   */
  parseConfig: (widgetId: string, config: unknown, storedSchemaVersion: number) => unknown;
};

export type WidgetServerRegistration = {
  definition: AnyWidgetDefinition;
  provider: AnyWidgetProvider;
};

/**
 * Erases a typed provider for storage in a heterogeneous server registry.
 */
export function toServerRegistration<TConfig, TData>(
  definition: AnyWidgetDefinition,
  provider: WidgetProvider<TConfig, TData>,
): WidgetServerRegistration {
  return {
    definition,
    provider: {
      id: provider.id,
      fetch: (ctx: WidgetProviderContext<unknown>) =>
        provider.fetch(ctx as WidgetProviderContext<TConfig>) as Promise<
          WidgetProviderResult<unknown>
        >,
    },
  };
}

export function createWidgetServerRegistry(
  entries: readonly WidgetServerRegistration[],
): WidgetServerRegistry {
  const definitions = new Map<string, AnyWidgetDefinition>();
  const providers = new Map<string, AnyWidgetProvider>();

  for (const entry of entries) {
    if (entry.definition.id !== entry.provider.id) {
      throw new Error(
        `Provider id "${entry.provider.id}" does not match definition id "${entry.definition.id}"`,
      );
    }
    if (definitions.has(entry.definition.id)) {
      throw new Error(`Duplicate widget id in server registry: "${entry.definition.id}"`);
    }
    definitions.set(entry.definition.id, entry.definition);
    providers.set(entry.provider.id, entry.provider);
  }

  return {
    getDefinition: (id) => definitions.get(id),
    requireDefinition: (id) => {
      const definition = definitions.get(id);
      if (!definition) {
        throw new Error(`Unknown widget id: "${id}"`);
      }
      return definition;
    },
    getProvider: (id) => providers.get(id),
    requireProvider: (id) => {
      const provider = providers.get(id);
      if (!provider) {
        throw new Error(`No provider registered for widget id: "${id}"`);
      }
      return provider;
    },
    has: (id) => definitions.has(id),
    ids: () => [...definitions.keys()].sort((a, b) => a.localeCompare(b, "en")),
    parseConfig: (widgetId, config, storedSchemaVersion) => {
      const definition = definitions.get(widgetId);
      if (!definition) {
        throw new Error(`Unknown widget id: "${widgetId}"`);
      }

      if (definition.migrateConfig) {
        return parseMigratedConfig(
          definition.configSchema,
          config,
          storedSchemaVersion,
          definition.migrateConfig,
        );
      }

      if (storedSchemaVersion !== definition.schemaVersion) {
        throw new Error(
          `Widget "${widgetId}" has no migration from schema v${storedSchemaVersion} to v${definition.schemaVersion}`,
        );
      }

      return definition.configSchema.parse(config);
    },
  };
}

export function asTypedProvider<TConfig, TData>(
  provider: AnyWidgetProvider,
): WidgetProvider<TConfig, TData> {
  return provider as WidgetProvider<TConfig, TData>;
}
