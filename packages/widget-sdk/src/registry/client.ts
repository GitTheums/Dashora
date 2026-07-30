import type { AnyWidgetDefinition } from "../definition.js";
import type { WidgetRendererComponent, WidgetSettingsComponent } from "./types.js";

export type WidgetClientRegistration = {
  definition: AnyWidgetDefinition;
  Renderer: WidgetRendererComponent;
  Settings?: WidgetSettingsComponent;
};

export type WidgetClientRegistry = {
  getDefinition: (id: string) => AnyWidgetDefinition | undefined;
  requireDefinition: (id: string) => AnyWidgetDefinition;
  getRenderer: (id: string) => WidgetRendererComponent | undefined;
  requireRenderer: (id: string) => WidgetRendererComponent;
  getSettings: (id: string) => WidgetSettingsComponent | undefined;
  has: (id: string) => boolean;
  ids: () => string[];
};

/**
 * Erases typed React components for storage in a heterogeneous client registry.
 */
export function toClientRegistration<TData, TConfig>(
  definition: AnyWidgetDefinition,
  Renderer: WidgetRendererComponent<TData, TConfig>,
  Settings?: WidgetSettingsComponent<TConfig>,
): WidgetClientRegistration {
  const entry: WidgetClientRegistration = {
    definition,
    Renderer: Renderer as WidgetRendererComponent,
  };
  if (Settings) {
    entry.Settings = Settings as WidgetSettingsComponent;
  }
  return entry;
}

export function createWidgetClientRegistry(
  entries: readonly WidgetClientRegistration[],
): WidgetClientRegistry {
  const definitions = new Map<string, AnyWidgetDefinition>();
  const renderers = new Map<string, WidgetRendererComponent>();
  const settings = new Map<string, WidgetSettingsComponent>();

  for (const entry of entries) {
    if (definitions.has(entry.definition.id)) {
      throw new Error(`Duplicate widget id in client registry: "${entry.definition.id}"`);
    }
    definitions.set(entry.definition.id, entry.definition);
    renderers.set(entry.definition.id, entry.Renderer);
    if (entry.Settings) {
      settings.set(entry.definition.id, entry.Settings);
    } else if (entry.definition.capabilities.hasSettings) {
      throw new Error(
        `Widget "${entry.definition.id}" declares hasSettings but no Settings component was registered`,
      );
    }
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
    getRenderer: (id) => renderers.get(id),
    requireRenderer: (id) => {
      const renderer = renderers.get(id);
      if (!renderer) {
        throw new Error(`No renderer registered for widget id: "${id}"`);
      }
      return renderer;
    },
    getSettings: (id) => settings.get(id),
    has: (id) => definitions.has(id),
    ids: () => [...definitions.keys()].sort((a, b) => a.localeCompare(b, "en")),
  };
}
