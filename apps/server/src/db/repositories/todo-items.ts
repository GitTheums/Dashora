import { and, asc, eq, inArray } from "drizzle-orm";
import type { DashoraDatabase } from "../client.js";
import { todoItems } from "../schema.js";
import { nowEpochMillis } from "../timestamps.js";

export type TodoItemRecord = typeof todoItems.$inferSelect;

export type NewTodoItemInput = {
  ownerUserId: string;
  instanceId: string;
  title: string;
  completed?: boolean;
  dueAt?: string | null;
  sortOrder?: number;
  id?: string;
  createdAt?: number;
  updatedAt?: number;
};

export type UpdateTodoItemInput = {
  title?: string;
  completed?: boolean;
  dueAt?: string | null;
  sortOrder?: number;
  updatedAt?: number;
};

export function createTodoItemsRepository(db: DashoraDatabase) {
  return {
    async listByOwnerAndInstance(
      ownerUserId: string,
      instanceId: string,
    ): Promise<TodoItemRecord[]> {
      return db
        .select()
        .from(todoItems)
        .where(and(eq(todoItems.ownerUserId, ownerUserId), eq(todoItems.instanceId, instanceId)))
        .orderBy(asc(todoItems.sortOrder), asc(todoItems.createdAt));
    },

    async findByIdForOwner(
      ownerUserId: string,
      instanceId: string,
      itemId: string,
    ): Promise<TodoItemRecord | undefined> {
      return db.query.todoItems.findFirst({
        where: and(
          eq(todoItems.id, itemId),
          eq(todoItems.ownerUserId, ownerUserId),
          eq(todoItems.instanceId, instanceId),
        ),
      });
    },

    async create(input: NewTodoItemInput): Promise<TodoItemRecord> {
      const now = nowEpochMillis();
      const [row] = await db
        .insert(todoItems)
        .values({
          id: input.id,
          ownerUserId: input.ownerUserId,
          instanceId: input.instanceId,
          title: input.title,
          completed: input.completed ?? false,
          dueAt: input.dueAt ?? null,
          sortOrder: input.sortOrder ?? 0,
          createdAt: input.createdAt ?? now,
          updatedAt: input.updatedAt ?? now,
        })
        .returning();
      if (!row) {
        throw new Error("Failed to create todo item");
      }
      return row;
    },

    async update(
      ownerUserId: string,
      instanceId: string,
      itemId: string,
      input: UpdateTodoItemInput,
    ): Promise<TodoItemRecord | undefined> {
      const patch: Partial<typeof todoItems.$inferInsert> = {
        updatedAt: input.updatedAt ?? nowEpochMillis(),
      };
      if (input.title !== undefined) {
        patch.title = input.title;
      }
      if (input.completed !== undefined) {
        patch.completed = input.completed;
      }
      if (input.dueAt !== undefined) {
        patch.dueAt = input.dueAt;
      }
      if (input.sortOrder !== undefined) {
        patch.sortOrder = input.sortOrder;
      }
      const [row] = await db
        .update(todoItems)
        .set(patch)
        .where(
          and(
            eq(todoItems.id, itemId),
            eq(todoItems.ownerUserId, ownerUserId),
            eq(todoItems.instanceId, instanceId),
          ),
        )
        .returning();
      return row;
    },

    async deleteById(ownerUserId: string, instanceId: string, itemId: string): Promise<boolean> {
      const result = await db
        .delete(todoItems)
        .where(
          and(
            eq(todoItems.id, itemId),
            eq(todoItems.ownerUserId, ownerUserId),
            eq(todoItems.instanceId, instanceId),
          ),
        )
        .returning({ id: todoItems.id });
      return result.length > 0;
    },

    async reorder(
      ownerUserId: string,
      instanceId: string,
      orderedIds: string[],
    ): Promise<TodoItemRecord[]> {
      const existing = await this.listByOwnerAndInstance(ownerUserId, instanceId);
      const existingIds = new Set(existing.map((item) => item.id));
      if (orderedIds.length !== existing.length || orderedIds.some((id) => !existingIds.has(id))) {
        throw new TodoItemsReorderError("orderedIds must include every item exactly once");
      }

      const now = nowEpochMillis();
      db.transaction((tx) => {
        for (const [index, id] of orderedIds.entries()) {
          tx.update(todoItems)
            .set({ sortOrder: index, updatedAt: now })
            .where(
              and(
                eq(todoItems.id, id),
                eq(todoItems.ownerUserId, ownerUserId),
                eq(todoItems.instanceId, instanceId),
              ),
            )
            .run();
        }
      });

      return this.listByOwnerAndInstance(ownerUserId, instanceId);
    },

    async deleteByInstance(ownerUserId: string, instanceId: string): Promise<number> {
      const result = await db
        .delete(todoItems)
        .where(and(eq(todoItems.ownerUserId, ownerUserId), eq(todoItems.instanceId, instanceId)))
        .returning({ id: todoItems.id });
      return result.length;
    },

    async countByIds(ownerUserId: string, instanceId: string, ids: string[]): Promise<number> {
      if (ids.length === 0) {
        return 0;
      }
      const rows = await db
        .select({ id: todoItems.id })
        .from(todoItems)
        .where(
          and(
            eq(todoItems.ownerUserId, ownerUserId),
            eq(todoItems.instanceId, instanceId),
            inArray(todoItems.id, ids),
          ),
        );
      return rows.length;
    },
  };
}

export class TodoItemsReorderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TodoItemsReorderError";
  }
}

export type TodoItemsRepository = ReturnType<typeof createTodoItemsRepository>;
