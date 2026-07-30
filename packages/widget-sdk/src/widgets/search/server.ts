export {
  SEARCH_ENGINE_PRESETS,
  SEARCH_DEFAULT_CONFIG,
  searchConfigSchema,
  searchDataSchema,
  searchEnginePresetIdSchema,
  searchQuickLinkSchema,
  validateSearchTemplate,
  buildSearchUrl,
  resolveSearchTemplate,
  resolveSearchData,
  type SearchConfig,
  type SearchData,
  type SearchEnginePresetId,
  type SearchQuickLink,
  type SearchTemplateValidation,
} from "./config.js";
export { SEARCH_WIDGET_ID, searchDefinition } from "./definition.js";
export { searchProvider } from "./provider.js";
export {
  parseKeyboardShortcut,
  matchesKeyboardShortcut,
  isEditableTarget,
  type ParsedShortcut,
} from "./keyboard.js";
