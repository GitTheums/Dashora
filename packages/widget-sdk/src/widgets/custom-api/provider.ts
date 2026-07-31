import { defineWidgetProvider } from "../../provider.js";
import {
  type CustomApiAdapter,
  CustomApiAdapterError,
  isCustomApiAdapterError,
} from "./adapter.js";
import { type CustomApiConfig, type CustomApiData, customApiConfigSchema } from "./config.js";
import { CUSTOM_API_WIDGET_ID } from "./definition.js";

export type CustomApiProviderDeps = {
  adapter: CustomApiAdapter;
};

function configurationMessage(config: CustomApiConfig): string | null {
  if (!config.url.trim()) {
    return "Set a request URL in settings.";
  }
  if (config.template === "text" && !config.mapping.textPath) {
    return "Configure a text JSON path in settings.";
  }
  if (config.template === "metric" && !config.mapping.metricValuePath) {
    return "Configure a metric value JSON path in settings.";
  }
  if (
    config.template === "list" &&
    (!config.mapping.listItemsPath || !config.mapping.listTitlePath)
  ) {
    return "Configure list items and title JSON paths in settings.";
  }
  if (config.template === "progress" && !config.mapping.progressValuePath) {
    return "Configure a progress value JSON path in settings.";
  }
  if (
    config.template === "status" &&
    !config.mapping.statusStatePath &&
    !config.mapping.statusLabelPath
  ) {
    return "Configure status JSON paths in settings.";
  }
  return null;
}

export function createCustomApiProvider(deps: CustomApiProviderDeps) {
  return defineWidgetProvider<CustomApiConfig, CustomApiData>({
    id: CUSTOM_API_WIDGET_ID,
    fetch: async (ctx) => {
      const config = customApiConfigSchema.parse(ctx.config);

      if (!config.enabled) {
        return { state: "disabled", message: "Custom API is disabled in settings." };
      }

      const missing = configurationMessage(config);
      if (missing) {
        return { state: "configuration-required", message: missing };
      }

      try {
        const result = await deps.adapter.fetch({
          config,
          resolveSecret: async (secretId) => {
            if (!ctx.getSecret) {
              return null;
            }
            return ctx.getSecret(secretId);
          },
          ...(ctx.signal ? { signal: ctx.signal } : {}),
          ...(ctx.forceRefresh !== undefined ? { forceRefresh: ctx.forceRefresh } : {}),
          now: ctx.now?.() ?? new Date(),
        });

        const isEmptyList =
          result.data.presentation.template === "list" &&
          (result.data.presentation.list?.items.length ?? 0) === 0;

        if (isEmptyList) {
          return {
            state: "empty",
            data: result.data,
            message: "The API response mapped to an empty list.",
            cacheStatus: result.cacheStatus,
          };
        }

        if (result.cacheStatus === "stale") {
          return {
            state: "stale",
            data: result.data,
            message: "Showing last good Custom API data while a refresh is due.",
            cacheStatus: "stale",
          };
        }

        if (ctx.forceRefresh) {
          return {
            state: "refreshing",
            data: result.data,
            message: "Refreshing Custom API…",
            cacheStatus: result.cacheStatus,
          };
        }

        return {
          state: "success",
          data: result.data,
          cacheStatus: result.cacheStatus,
        };
      } catch (error) {
        if (isCustomApiAdapterError(error)) {
          if (error.code === "configuration_required") {
            return {
              state: "configuration-required",
              message: error.message,
              errorCode: error.code,
            };
          }
          return {
            state: "error",
            message: error.message,
            errorCode: error.code,
          };
        }
        if (error instanceof CustomApiAdapterError) {
          return {
            state: "error",
            message: error.message,
            errorCode: error.code,
          };
        }
        return {
          state: "error",
          message: "Could not load the Custom API response.",
          errorCode: "custom_api_fetch_failed",
        };
      }
    },
  });
}
