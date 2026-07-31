export {
  IFRAME_ASPECT_RATIO_VALUES,
  IFRAME_DEFAULT_CONFIG,
  buildIframeSandboxAttribute,
  hostnameMatchesAllow,
  iframeAspectRatioSchema,
  iframeConfigSchema,
  iframeDataSchema,
  iframeEmbedProbeSchema,
  iframeSandboxFlagsSchema,
  resolveIframeAspectRatio,
  validateIframeUrl,
  type IframeAspectRatio,
  type IframeConfig,
  type IframeData,
  type IframeEmbedProbe,
  type IframeSandboxFlags,
} from "./config.js";
export { IFRAME_WIDGET_ID, iframeDefinition } from "./definition.js";
export {
  createIframeProvider,
  iframeProvider,
  type IframeProviderDeps,
} from "./provider.js";
export type { IframeAdapter, IframeProbeRequest } from "./adapter.js";
export { IframeAdapterError, isIframeAdapterError } from "./adapter.js";
