import { type AnyWidgetDefinition, type WidgetMetadata, toWidgetMetadata } from "../definition.js";

export type WidgetMetadataRegistry = {
  /** All registered metadata, sorted by name. */
  list: () => WidgetMetadata[];
  get: (id: string) => WidgetMetadata | undefined;
  has: (id: string) => boolean;
  ids: () => string[];
  /** Throws when the id is unknown — use when saving layouts/config. */
  require: (id: string) => WidgetMetadata;
  getByCategory: (category: WidgetMetadata["category"]) => WidgetMetadata[];
};

export function createWidgetMetadataRegistry(
  definitions: readonly AnyWidgetDefinition[],
): WidgetMetadataRegistry {
  const map = new Map<string, WidgetMetadata>();

  for (const definition of definitions) {
    if (map.has(definition.id)) {
      throw new Error(`Duplicate widget id in metadata registry: "${definition.id}"`);
    }
    map.set(definition.id, toWidgetMetadata(definition));
  }

  return {
    list: () => [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "en")),
    get: (id) => map.get(id),
    has: (id) => map.has(id),
    ids: () => [...map.keys()].sort((a, b) => a.localeCompare(b, "en")),
    require: (id) => {
      const entry = map.get(id);
      if (!entry) {
        throw new Error(`Unknown widget id: "${id}"`);
      }
      return entry;
    },
    getByCategory: (category) =>
      [...map.values()]
        .filter((entry) => entry.category === category)
        .sort((a, b) => a.name.localeCompare(b.name, "en")),
  };
}
