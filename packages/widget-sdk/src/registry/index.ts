export {
  createWidgetMetadataRegistry,
  type WidgetMetadataRegistry,
} from "./metadata.js";
export {
  createWidgetServerRegistry,
  toServerRegistration,
  asTypedProvider,
  type WidgetServerRegistry,
  type WidgetServerRegistration,
} from "./server.js";
export {
  createWidgetClientRegistry,
  toClientRegistration,
  type WidgetClientRegistry,
  type WidgetClientRegistration,
} from "./client.js";
export type {
  WidgetRendererProps,
  WidgetSettingsProps,
  WidgetRendererComponent,
  WidgetSettingsComponent,
  WidgetRegistryEntry,
  AnyWidgetRegistryEntry,
} from "./types.js";
