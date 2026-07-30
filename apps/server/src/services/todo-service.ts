import {
  type CreateTodoItemRequest,
  type TodoItem,
  type UpdateTodoItemRequest,
  createTodoItemRequestSchema,
  reorderTodoItemsRequestSchema,
  updateTodoItemRequestSchema,
} from "@dashora/widget-sdk/widgets/todo/server";
import type { Repositories } from "../db/repositories/index.js";
import type { TodoItemRecord } from "../db/repositories/todo-items.js";
import { TodoItemsReorderError } from "../db/repositories/todo-items.js";

export class TodoServiceError extends Error {
  readonly code: "not_found" | "validation_error" | "invalid_order";

  constructor(code: TodoServiceError["code"], message: string) {
    super(message);
    this.name = "TodoServiceError";
    this.code = code;
  }
}

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

function mapItem(row: TodoItemRecord): TodoItem {
  return {
    id: row.id,
    title: row.title,
    completed: row.completed,
    dueAt: row.dueAt,
    sortOrder: row.sortOrder,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

const instanceIdSchema =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createTodoService(repos: Repositories) {
  function assertInstanceId(instanceId: string): void {
    if (!instanceIdSchema.test(instanceId)) {
      throw new TodoServiceError("validation_error", "Instance id must be a UUID");
    }
  }

  return {
    async list(ownerUserId: string, instanceId: string): Promise<TodoItem[]> {
      assertInstanceId(instanceId);
      const rows = await repos.todoItems.listByOwnerAndInstance(ownerUserId, instanceId);
      return rows.map(mapItem);
    },

    async create(ownerUserId: string, instanceId: string, raw: unknown): Promise<TodoItem> {
      assertInstanceId(instanceId);
      const parsed = createTodoItemRequestSchema.safeParse(raw);
      if (!parsed.success) {
        throw new TodoServiceError("validation_error", "Invalid todo payload");
      }
      const input: CreateTodoItemRequest = parsed.data;
      const existing = await repos.todoItems.listByOwnerAndInstance(ownerUserId, instanceId);
      const sortOrder =
        existing.length === 0 ? 0 : Math.max(...existing.map((item) => item.sortOrder)) + 1;
      const row = await repos.todoItems.create({
        ownerUserId,
        instanceId,
        title: input.title,
        dueAt: input.dueAt ?? null,
        sortOrder,
      });
      return mapItem(row);
    },

    async update(
      ownerUserId: string,
      instanceId: string,
      itemId: string,
      raw: unknown,
    ): Promise<TodoItem> {
      assertInstanceId(instanceId);
      const parsed = updateTodoItemRequestSchema.safeParse(raw);
      if (!parsed.success) {
        throw new TodoServiceError("validation_error", "Invalid todo update payload");
      }
      const input: UpdateTodoItemRequest = parsed.data;
      const row = await repos.todoItems.update(ownerUserId, instanceId, itemId, {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.completed !== undefined ? { completed: input.completed } : {}),
        ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
      });
      if (!row) {
        throw new TodoServiceError("not_found", "Todo item not found");
      }
      return mapItem(row);
    },

    async remove(ownerUserId: string, instanceId: string, itemId: string): Promise<void> {
      assertInstanceId(instanceId);
      const deleted = await repos.todoItems.deleteById(ownerUserId, instanceId, itemId);
      if (!deleted) {
        throw new TodoServiceError("not_found", "Todo item not found");
      }
    },

    async reorder(ownerUserId: string, instanceId: string, raw: unknown): Promise<TodoItem[]> {
      assertInstanceId(instanceId);
      const parsed = reorderTodoItemsRequestSchema.safeParse(raw);
      if (!parsed.success) {
        throw new TodoServiceError("validation_error", "Invalid reorder payload");
      }
      try {
        const rows = await repos.todoItems.reorder(ownerUserId, instanceId, parsed.data.orderedIds);
        return rows.map(mapItem);
      } catch (error) {
        if (error instanceof TodoItemsReorderError) {
          throw new TodoServiceError("invalid_order", error.message);
        }
        throw error;
      }
    },
  };
}

export type TodoService = ReturnType<typeof createTodoService>;
