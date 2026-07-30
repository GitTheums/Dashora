export {
  REQUIRED_WIDGET_STATES,
  DATAFUL_WIDGET_STATES,
  widgetStateSchema,
  assertCoversRequiredStates,
  isDatafulWidgetState,
  type WidgetState,
  type DatafulWidgetState,
} from "./states.js";

export {
  widgetCapabilitiesSchema,
  DEFAULT_WIDGET_CAPABILITIES,
  type WidgetCapabilities,
} from "./capabilities.js";

export {
  WIDGET_CATEGORIES,
  WIDGET_CATEGORY_LABELS,
  widgetCategorySchema,
  type WidgetCategory,
} from "./categories.js";

export { widgetIconSchema, type WidgetIcon } from "./icons.js";

export {
  widgetDefaultLayoutSchema,
  DEFAULT_WIDGET_LAYOUT,
  type WidgetDefaultLayout,
} from "./layout.js";

export {
  widgetCachePolicySchema,
  widgetRefreshPolicySchema,
  widgetCacheStatusSchema,
  DEFAULT_WIDGET_CACHE_POLICY,
  DEFAULT_WIDGET_REFRESH_POLICY,
  type WidgetCachePolicy,
  type WidgetRefreshPolicy,
  type WidgetCacheStatus,
} from "./cache.js";

export {
  migrateWidgetConfig,
  parseMigratedConfig,
  WidgetConfigMigrationError,
  widgetConfigVersionSchema,
  type WidgetConfigMigration,
  type WidgetConfigMigrationStep,
} from "./migration.js";

export {
  widgetResponseMetaSchema,
  widgetDataResponseSchema,
  createWidgetDataResponse,
  type WidgetResponseMeta,
  type WidgetDataResponse,
} from "./envelope.js";

export {
  defineWidget,
  toWidgetMetadata,
  widgetMetadataSchema,
  widgetDefinitionSchema,
  type WidgetDefinition,
  type WidgetMetadata,
  type AnyWidgetDefinition,
  type DefineWidgetDefinitionInput,
  type LegacyWidgetDefinition,
} from "./definition.js";

export {
  defineWidgetProvider,
  createValidatedProvider,
  type WidgetProvider,
  type WidgetProviderContext,
  type WidgetProviderResult,
  type AnyWidgetProvider,
  type DefineWidgetProviderInput,
} from "./provider.js";

export {
  createWidgetMetadataRegistry,
  createWidgetServerRegistry,
  createWidgetClientRegistry,
  toServerRegistration,
  toClientRegistration,
  asTypedProvider,
  type WidgetMetadataRegistry,
  type WidgetServerRegistry,
  type WidgetServerRegistration,
  type WidgetClientRegistry,
  type WidgetClientRegistration,
  type WidgetRendererProps,
  type WidgetSettingsProps,
  type WidgetRendererComponent,
  type WidgetSettingsComponent,
  type WidgetRegistryEntry,
  type AnyWidgetRegistryEntry,
} from "./registry/index.js";
