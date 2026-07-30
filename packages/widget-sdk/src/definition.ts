import { z } from "zod";
import {
  DEFAULT_WIDGET_CACHE_POLICY,
  DEFAULT_WIDGET_REFRESH_POLICY,
  type WidgetCachePolicy,
  type WidgetRefreshPolicy,
  widgetCachePolicySchema,
  widgetRefreshPolicySchema,
} from "./cache.js";
import {
  DEFAULT_WIDGET_CAPABILITIES,
  type WidgetCapabilities,
  widgetCapabilitiesSchema,
} from "./capabilities.js";
import { type WidgetCategory, widgetCategorySchema } from "./categories.js";
import { type WidgetIcon, widgetIconSchema } from "./icons.js";
import {
  DEFAULT_WIDGET_LAYOUT,
  type WidgetDefaultLayout,
  widgetDefaultLayoutSchema,
} from "./layout.js";
import type { WidgetConfigMigration } from "./migration.js";
import {
  REQUIRED_WIDGET_STATES,
  type WidgetState,
  assertCoversRequiredStates,
  widgetStateSchema,
} from "./states.js";

/**
 * Serializable metadata portion of a widget definition (no Zod functions / React).
 * Safe to expose on catalog APIs.
 */
export const widgetMetadataSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1).max(80),
  version: z.string().min(1).max(32),
  schemaVersion: z.number().int().min(1),
  description: z.string().min(1).max(500),
  category: widgetCategorySchema,
  icon: widgetIconSchema,
  states: z.array(widgetStateSchema).nonempty(),
  defaultLayout: widgetDefaultLayoutSchema,
  capabilities: widgetCapabilitiesSchema,
  cache: widgetCachePolicySchema,
  refresh: widgetRefreshPolicySchema,
});

export type WidgetMetadata = z.infer<typeof widgetMetadataSchema>;

/**
 * Full typed widget definition used by the in-repo registry.
 * `configSchema` remains a runtime Zod object (not serialized over the wire).
 */
export type WidgetDefinition<TConfig extends z.ZodType = z.ZodTypeAny> = {
  id: string;
  name: string;
  version: string;
  /** Monotonic config schema version for migrations. */
  schemaVersion: number;
  description: string;
  category: WidgetCategory;
  icon: WidgetIcon;
  states: readonly WidgetState[];
  configSchema: TConfig;
  defaultConfig: z.infer<TConfig>;
  defaultLayout: WidgetDefaultLayout;
  capabilities: WidgetCapabilities;
  cache: WidgetCachePolicy;
  refresh: WidgetRefreshPolicy;
  /** Ordered migration steps up to `schemaVersion`. */
  migrateConfig?: WidgetConfigMigration;
};

export type AnyWidgetDefinition = WidgetDefinition<z.ZodTypeAny>;

export type DefineWidgetDefinitionInput<TConfig extends z.ZodType> = {
  id: string;
  name: string;
  version: string;
  schemaVersion: number;
  description: string;
  category: WidgetCategory;
  icon: WidgetIcon;
  configSchema: TConfig;
  defaultConfig: z.infer<TConfig>;
  defaultLayout?: Partial<WidgetDefaultLayout>;
  capabilities?: Partial<WidgetCapabilities>;
  cache?: Partial<WidgetCachePolicy>;
  refresh?: Partial<WidgetRefreshPolicy>;
  states?: readonly WidgetState[];
  migrateConfig?: WidgetConfigMigration;
};

/**
 * Creates a validated widget definition. Ensures required states and parses defaults.
 */
export function defineWidget<TConfig extends z.ZodType>(
  input: DefineWidgetDefinitionInput<TConfig>,
): WidgetDefinition<TConfig> {
  const states = input.states ?? REQUIRED_WIDGET_STATES;
  assertCoversRequiredStates(states, input.id);

  const capabilities = widgetCapabilitiesSchema.parse({
    ...DEFAULT_WIDGET_CAPABILITIES,
    ...input.capabilities,
  });
  const defaultLayout = widgetDefaultLayoutSchema.parse({
    ...DEFAULT_WIDGET_LAYOUT,
    ...input.defaultLayout,
  });
  const cache = widgetCachePolicySchema.parse({
    ...DEFAULT_WIDGET_CACHE_POLICY,
    ...input.cache,
  });
  const refresh = widgetRefreshPolicySchema.parse({
    ...DEFAULT_WIDGET_REFRESH_POLICY,
    ...input.refresh,
  });

  const defaultConfig = input.configSchema.parse(input.defaultConfig);

  if (input.migrateConfig && input.migrateConfig.currentVersion !== input.schemaVersion) {
    throw new Error(
      `Widget "${input.id}" migrateConfig.currentVersion (${input.migrateConfig.currentVersion}) must equal schemaVersion (${input.schemaVersion})`,
    );
  }

  const definition: WidgetDefinition<TConfig> = {
    id: input.id,
    name: input.name,
    version: input.version,
    schemaVersion: input.schemaVersion,
    description: input.description,
    category: input.category,
    icon: input.icon,
    states,
    configSchema: input.configSchema,
    defaultConfig,
    defaultLayout,
    capabilities,
    cache,
    refresh,
    ...(input.migrateConfig ? { migrateConfig: input.migrateConfig } : {}),
  };

  // Validate serializable metadata shape early.
  toWidgetMetadata(definition);

  return definition;
}

export function toWidgetMetadata(definition: AnyWidgetDefinition): WidgetMetadata {
  return widgetMetadataSchema.parse({
    id: definition.id,
    name: definition.name,
    version: definition.version,
    schemaVersion: definition.schemaVersion,
    description: definition.description,
    category: definition.category,
    icon: definition.icon,
    states: [...definition.states],
    defaultLayout: definition.defaultLayout,
    capabilities: definition.capabilities,
    cache: definition.cache,
    refresh: definition.refresh,
  });
}

/** @deprecated Prefer `defineWidget` + `WidgetDefinition`. Kept for early callers. */
export const widgetDefinitionSchema = widgetMetadataSchema;

/** @deprecated Prefer `WidgetMetadata` or `WidgetDefinition`. */
export type LegacyWidgetDefinition = WidgetMetadata;
