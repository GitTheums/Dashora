import { afterEach, describe, expect, it } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import {
  TODO_DEFAULT_CONFIG,
  type TodoItem,
  clearTodoMemoryStore,
  filterVisibleTodoItems,
  seedTodoMemoryStore,
  todoConfigSchema,
  todoDefinition,
  todoProvider,
} from "./index.js";

const sampleItem = (overrides: Partial<TodoItem> = {}): TodoItem => ({
  id: "33333333-3333-4333-8333-333333333333",
  title: "Write tests",
  completed: false,
  dueAt: null,
  sortOrder: 0,
  createdAt: "2026-07-30T10:00:00.000Z",
  updatedAt: "2026-07-30T10:00:00.000Z",
  ...overrides,
});

describe("todo definition", () => {
  it("covers every required runtime state", () => {
    expect(todoDefinition.states).toEqual(REQUIRED_WIDGET_STATES);
    expect(todoDefinition.id).toBe("todo");
  });

  it("parses default config", () => {
    expect(todoConfigSchema.parse({})).toEqual(TODO_DEFAULT_CONFIG);
  });
});

describe("todo visibility", () => {
  it("hides completed items when configured", () => {
    const items = [
      sampleItem({ id: "33333333-3333-4333-8333-333333333331", completed: false, sortOrder: 0 }),
      sampleItem({ id: "33333333-3333-4333-8333-333333333332", completed: true, sortOrder: 1 }),
    ];
    expect(filterVisibleTodoItems(items, false)).toHaveLength(1);
    expect(filterVisibleTodoItems(items, true)).toHaveLength(2);
  });
});

describe("todo provider", () => {
  afterEach(() => {
    clearTodoMemoryStore();
  });

  it("returns empty when there are no items", async () => {
    const result = await todoProvider.fetch({
      instanceId: "t1",
      config: TODO_DEFAULT_CONFIG,
    });
    expect(result.state).toBe("empty");
  });

  it("returns success when items exist", async () => {
    seedTodoMemoryStore("t2", [sampleItem()]);
    const result = await todoProvider.fetch({
      instanceId: "t2",
      config: TODO_DEFAULT_CONFIG,
    });
    expect(result.state).toBe("success");
    expect(result.data?.items).toHaveLength(1);
  });

  it("returns disabled when enabled is false", async () => {
    const result = await todoProvider.fetch({
      instanceId: "t3",
      config: { ...TODO_DEFAULT_CONFIG, enabled: false },
    });
    expect(result.state).toBe("disabled");
  });
});
