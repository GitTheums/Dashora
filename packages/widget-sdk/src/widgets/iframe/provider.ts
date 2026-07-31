import { defineWidgetProvider } from "../../provider.js";
import type { IframeAdapter } from "./adapter.js";
import { isIframeAdapterError } from "./adapter.js";
import {
  type IframeConfig,
  type IframeData,
  buildIframeSandboxAttribute,
  iframeConfigSchema,
  iframeDataSchema,
  resolveIframeAspectRatio,
  validateIframeUrl,
} from "./config.js";
import { IFRAME_WIDGET_ID } from "./definition.js";

export type IframeProviderDeps = {
  adapter?: IframeAdapter;
};

export function createIframeProvider(deps: IframeProviderDeps = {}) {
  return defineWidgetProvider<IframeConfig, IframeData>({
    id: IFRAME_WIDGET_ID,
    fetch: async (ctx) => {
      const config = iframeConfigSchema.parse(ctx.config);

      if (!config.enabled) {
        return { state: "disabled", message: "iFrame is disabled in settings." };
      }

      const validated = validateIframeUrl(config.url, config.allowList);
      if (!validated.ok) {
        return {
          state: "configuration-required",
          message: validated.message,
        };
      }

      let embedProbe = null;
      if (deps.adapter) {
        try {
          embedProbe = await deps.adapter.probeEmbedding({
            url: validated.url,
            ...(ctx.signal ? { signal: ctx.signal } : {}),
            now: ctx.now?.() ?? new Date(),
          });
        } catch (error) {
          if (isIframeAdapterError(error)) {
            embedProbe = {
              checkedAt: (ctx.now?.() ?? new Date()).toISOString(),
              embeddingRefused: false,
              warning: error.message,
              urlLabel: validated.url,
            };
          } else {
            embedProbe = {
              checkedAt: (ctx.now?.() ?? new Date()).toISOString(),
              embeddingRefused: false,
              warning: "Could not verify whether the target allows embedding.",
              urlLabel: validated.url,
            };
          }
        }
      }

      const data = iframeDataSchema.parse({
        url: validated.url,
        aspectRatio: resolveIframeAspectRatio(config),
        sandbox: buildIframeSandboxAttribute(config.sandbox),
        frameTitle: config.frameTitle,
        embedProbe,
      });

      return {
        state: "success",
        data,
        cacheStatus: "miss",
      };
    },
  });
}

export const iframeProvider = createIframeProvider();
