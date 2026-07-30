import {
  createWidgetDataResponse,
  createWidgetMetadataRegistry,
  createWidgetServerRegistry,
  toServerRegistration,
  widgetDataResponseSchema,
} from "@dashora/widget-sdk";
import {
  demoMetricsDefinition,
  demoMetricsProvider,
} from "@dashora/widget-sdk/examples/demo-metrics/server";
import {
  bookmarksDefinition,
  bookmarksProvider,
} from "@dashora/widget-sdk/widgets/bookmarks/server";
import { clockDefinition, clockProvider } from "@dashora/widget-sdk/widgets/clock/server";
import { searchDefinition, searchProvider } from "@dashora/widget-sdk/widgets/search/server";
import {
  type TodoItem,
  createTodoProvider,
  todoDefinition,
} from "@dashora/widget-sdk/widgets/todo/server";
import type { TodoService } from "../services/todo-service.js";

export function createDashoraWidgetServerRegistry(todoService?: TodoService) {
  const todoProvider = createTodoProvider({
    listByInstance: async (instanceId) => {
      if (!todoService) {
        return [] as TodoItem[];
      }
      // Owner is resolved in HTTP routes; provider store is only used when
      // routes inject a scoped adapter. Return empty here as a safe default.
      void instanceId;
      return [];
    },
  });

  return createWidgetServerRegistry([
    toServerRegistration(searchDefinition, searchProvider),
    toServerRegistration(clockDefinition, clockProvider),
    toServerRegistration(bookmarksDefinition, bookmarksProvider),
    toServerRegistration(todoDefinition, todoProvider),
    toServerRegistration(demoMetricsDefinition, demoMetricsProvider),
  ]);
}

export const widgetMetadataRegistry = createWidgetMetadataRegistry([
  searchDefinition,
  clockDefinition,
  bookmarksDefinition,
  todoDefinition,
  demoMetricsDefinition,
]);

export { createWidgetDataResponse, widgetDataResponseSchema };
