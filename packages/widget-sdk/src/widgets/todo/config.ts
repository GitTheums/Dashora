import { z } from "zod";

export const todoViewModeSchema = z.enum(["compact", "detailed"]);
export type TodoViewMode = z.infer<typeof todoViewModeSchema>;

export const todoConfigSchema = z.object({
  viewMode: todoViewModeSchema.default("detailed"),
  showCompleted: z.boolean().default(true),
  enabled: z.boolean().default(true),
});

export type TodoConfig = z.infer<typeof todoConfigSchema>;

export const TODO_DEFAULT_CONFIG: TodoConfig = todoConfigSchema.parse({});

export const todoItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  completed: z.boolean(),
  dueAt: z.string().datetime({ offset: true }).nullable(),
  sortOrder: z.number().int(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export type TodoItem = z.infer<typeof todoItemSchema>;

export const todoDataSchema = z.object({
  items: z.array(todoItemSchema),
  viewMode: todoViewModeSchema,
  showCompleted: z.boolean(),
});

export type TodoData = z.infer<typeof todoDataSchema>;

export const createTodoItemRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  dueAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export type CreateTodoItemRequest = z.infer<typeof createTodoItemRequestSchema>;

export const updateTodoItemRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    completed: z.boolean().optional(),
    dueAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined || value.completed !== undefined || value.dueAt !== undefined,
    { message: "At least one field is required" },
  );

export type UpdateTodoItemRequest = z.infer<typeof updateTodoItemRequestSchema>;

export const reorderTodoItemsRequestSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1).max(500),
});

export type ReorderTodoItemsRequest = z.infer<typeof reorderTodoItemsRequestSchema>;

export const todoItemsResponseSchema = z.object({
  items: z.array(todoItemSchema),
});

export type TodoItemsResponse = z.infer<typeof todoItemsResponseSchema>;

export const todoItemResponseSchema = z.object({
  item: todoItemSchema,
});

export type TodoItemResponse = z.infer<typeof todoItemResponseSchema>;

export function filterVisibleTodoItems(items: TodoItem[], showCompleted: boolean): TodoItem[] {
  const filtered = showCompleted ? items : items.filter((item) => !item.completed);
  return [...filtered].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    return a.sortOrder - b.sortOrder;
  });
}
