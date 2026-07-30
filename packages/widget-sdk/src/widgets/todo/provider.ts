import { defineWidgetProvider } from "../../provider.js";
import {
  type TodoConfig,
  type TodoData,
  type TodoItem,
  filterVisibleTodoItems,
  todoConfigSchema,
} from "./config.js";
import { TODO_WIDGET_ID } from "./definition.js";

export type TodoItemStore = {
  listByInstance: (instanceId: string) => Promise<TodoItem[]>;
};

const memory = new Map<string, TodoItem[]>();

export function clearTodoMemoryStore(): void {
  memory.clear();
}

export function seedTodoMemoryStore(instanceId: string, items: TodoItem[]): void {
  memory.set(instanceId, items);
}

export const memoryTodoItemStore: TodoItemStore = {
  async listByInstance(instanceId) {
    return memory.get(instanceId) ?? [];
  },
};

export function createTodoProvider(store: TodoItemStore = memoryTodoItemStore) {
  return defineWidgetProvider<TodoConfig, TodoData>({
    id: TODO_WIDGET_ID,
    fetch: async (ctx) => {
      const config = todoConfigSchema.parse(ctx.config);

      if (!config.enabled) {
        return { state: "disabled", message: "Todo is disabled in settings." };
      }

      try {
        const items = await store.listByInstance(ctx.instanceId);
        const visible = filterVisibleTodoItems(items, config.showCompleted);
        const data: TodoData = {
          items: visible,
          viewMode: config.viewMode,
          showCompleted: config.showCompleted,
        };

        if (visible.length === 0) {
          return {
            state: "empty",
            data,
            message: config.showCompleted
              ? "Your completed and upcoming tasks will appear here."
              : "No open tasks. Turn on completed tasks in settings to review finished work.",
            cacheStatus: "miss",
          };
        }

        return {
          state: "success",
          data,
          cacheStatus: "miss",
        };
      } catch {
        return {
          state: "error",
          message: "Could not load tasks.",
          errorCode: "todo_load_failed",
        };
      }
    },
  });
}

/** Default provider backed by an in-memory store (tests / local demos). */
export const todoProvider = createTodoProvider();
