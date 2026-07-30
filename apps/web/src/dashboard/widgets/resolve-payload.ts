import type { WidgetState } from "@dashora/widget-sdk";
import {
  DEMO_METRICS_DEFAULT_CONFIG,
  DEMO_METRICS_WIDGET_ID,
  demoMetricsConfigSchema,
} from "@dashora/widget-sdk/examples/demo-metrics";
import {
  BOOKMARKS_WIDGET_ID,
  bookmarksConfigSchema,
  resolveBookmarksData,
} from "@dashora/widget-sdk/widgets/bookmarks";
import {
  CLOCK_WIDGET_ID,
  buildClockData,
  clockConfigSchema,
} from "@dashora/widget-sdk/widgets/clock";
import {
  SEARCH_WIDGET_ID,
  resolveSearchData,
  searchConfigSchema,
} from "@dashora/widget-sdk/widgets/search";
import {
  TODO_WIDGET_ID,
  createTodoClient,
  filterVisibleTodoItems,
  todoConfigSchema,
} from "@dashora/widget-sdk/widgets/todo";

export type ResolvedWidgetPayload = {
  state: WidgetState;
  data?: unknown;
  message?: string;
};

const todoClient = createTodoClient();

function payload(
  state: WidgetState,
  options: { data?: unknown; message?: string } = {},
): ResolvedWidgetPayload {
  return {
    state,
    ...(options.data !== undefined ? { data: options.data } : {}),
    ...(options.message !== undefined ? { message: options.message } : {}),
  };
}

function disabledPayload(message: string): ResolvedWidgetPayload {
  return payload("disabled", { message });
}

/**
 * Resolves display data for registered widgets on the client.
 * Config-backed widgets derive payloads locally; Todo loads from the API.
 */
export async function resolveTypedWidgetPayload(
  type: string,
  instanceId: string,
  rawConfig: unknown,
  enabled: boolean,
): Promise<ResolvedWidgetPayload> {
  if (!enabled) {
    return disabledPayload("Widget disabled");
  }

  switch (type) {
    case SEARCH_WIDGET_ID: {
      const config = searchConfigSchema.parse(rawConfig);
      if (!config.enabled) {
        return disabledPayload("Search is disabled in settings.");
      }
      const data = resolveSearchData(config);
      if (!data) {
        return payload("configuration-required", {
          message: "Choose a search engine or provide a safe custom template with {query}.",
        });
      }
      return payload("success", { data });
    }
    case CLOCK_WIDGET_ID: {
      const config = clockConfigSchema.parse(rawConfig);
      if (!config.enabled) {
        return disabledPayload("Clock is disabled in settings.");
      }
      return payload("success", { data: buildClockData(config) });
    }
    case BOOKMARKS_WIDGET_ID: {
      const config = bookmarksConfigSchema.parse(rawConfig);
      if (!config.enabled) {
        return disabledPayload("Bookmarks is disabled in settings.");
      }
      const data = resolveBookmarksData(config);
      if (data.totalItems === 0) {
        return payload("empty", {
          data,
          message: "Add bookmark groups and links in settings.",
        });
      }
      return payload("success", { data });
    }
    case TODO_WIDGET_ID: {
      const config = todoConfigSchema.parse(rawConfig);
      if (!config.enabled) {
        return disabledPayload("Todo is disabled in settings.");
      }
      try {
        const items = await todoClient.list(instanceId);
        const visible = filterVisibleTodoItems(items, config.showCompleted);
        const data = {
          items: visible,
          viewMode: config.viewMode,
          showCompleted: config.showCompleted,
        };
        if (visible.length === 0) {
          return payload("empty", {
            data,
            message: config.showCompleted
              ? "Your completed and upcoming tasks will appear here."
              : "No open tasks. Turn on completed tasks in settings to review finished work.",
          });
        }
        return payload("success", { data });
      } catch (error) {
        return payload("error", {
          message: error instanceof Error ? error.message : "Could not load tasks.",
        });
      }
    }
    case DEMO_METRICS_WIDGET_ID: {
      const config = demoMetricsConfigSchema.parse(rawConfig ?? DEMO_METRICS_DEFAULT_CONFIG);
      if (!config.enabled) {
        return disabledPayload("Demo metrics is disabled in configuration");
      }
      if (config.forceState) {
        const forced = config.forceState;
        if (forced === "success" || forced === "stale" || forced === "refreshing") {
          return payload(forced, {
            data: {
              label: config.metricLabel,
              value: config.seedValue,
              warningThreshold: config.warningThreshold,
              unit: "count",
              generatedAt: new Date().toISOString(),
            },
            ...(forced === "stale"
              ? { message: "Showing cached demo metrics while a refresh is due." }
              : forced === "refreshing"
                ? { message: "Refreshing demo metrics…" }
                : {}),
          });
        }
        return payload(forced, {
          ...(forced === "error"
            ? { message: "Demo metrics provider failed on purpose." }
            : forced === "empty"
              ? { message: "No demo metrics are available." }
              : forced === "configuration-required"
                ? { message: "Complete setup to use this widget." }
                : {}),
        });
      }
      if (config.seedValue === 0) {
        return payload("empty", {
          message: "No demo metrics are available for this configuration.",
        });
      }
      return payload("success", {
        data: {
          label: config.metricLabel,
          value: config.seedValue,
          warningThreshold: config.warningThreshold,
          unit: "count",
          generatedAt: new Date().toISOString(),
        },
      });
    }
    default:
      return payload("error", {
        message: `No data adapter is registered for “${type}”.`,
      });
  }
}
