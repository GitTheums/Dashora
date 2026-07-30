import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import type { TodoClient } from "./client.js";
import { TODO_DEFAULT_CONFIG, type TodoData, type TodoItem } from "./config.js";
import { TodoRenderer } from "./renderer.js";
import { TodoSettings } from "./settings.js";

const sampleItem: TodoItem = {
  id: "33333333-3333-4333-8333-333333333333",
  title: "Ship widgets",
  completed: false,
  dueAt: null,
  sortOrder: 0,
  createdAt: "2026-07-30T10:00:00.000Z",
  updatedAt: "2026-07-30T10:00:00.000Z",
};

const sampleData: TodoData = {
  items: [sampleItem],
  viewMode: "detailed",
  showCompleted: true,
};

const emptyData: TodoData = {
  items: [],
  viewMode: "detailed",
  showCompleted: true,
};

function createMockClient(overrides: Partial<TodoClient> = {}): TodoClient {
  return {
    list: vi.fn(async () => [sampleItem]),
    create: vi.fn(async (_instanceId, input) => ({
      ...sampleItem,
      id: "44444444-4444-4444-8444-444444444444",
      title: input.title,
      dueAt: input.dueAt ?? null,
    })),
    update: vi.fn(async (_instanceId, _itemId, input) => ({
      ...sampleItem,
      ...input,
      title: input.title ?? sampleItem.title,
      completed: input.completed ?? sampleItem.completed,
      updatedAt: new Date().toISOString(),
    })),
    remove: vi.fn(async () => undefined),
    reorder: vi.fn(async (_instanceId, input: { orderedIds: string[] }) =>
      input.orderedIds.map((id: string, sortOrder: number) => ({
        ...sampleItem,
        id,
        sortOrder,
      })),
    ),
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

describe("TodoRenderer", () => {
  it.each(REQUIRED_WIDGET_STATES)("renders state=%s", (state) => {
    render(
      <TodoRenderer
        instanceId="1"
        title="Todo"
        config={TODO_DEFAULT_CONFIG}
        state={state}
        {...(state === "success" || state === "empty" || state === "stale" || state === "refreshing"
          ? { data: sampleData }
          : {})}
        message={`msg-${state}`}
        client={createMockClient()}
      />,
    );
    expect(document.querySelector(`[data-widget="todo"][data-state="${state}"]`)).toBeTruthy();
  });

  it("renders a task input in the empty state", () => {
    render(
      <TodoRenderer
        instanceId="1"
        title="Todo"
        config={TODO_DEFAULT_CONFIG}
        state="empty"
        data={emptyData}
        message="Your completed and upcoming tasks will appear here."
        client={createMockClient()}
      />,
    );
    expect(screen.getByPlaceholderText("Add a task…")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add" })).toBeTruthy();
    expect(screen.getByText("Nothing here yet")).toBeTruthy();
    expect(screen.queryByText(/Add one below/i)).toBeNull();
  });

  it("creates a task when Add is clicked", async () => {
    const client = createMockClient();
    render(
      <TodoRenderer
        instanceId="inst-1"
        title="Todo"
        config={TODO_DEFAULT_CONFIG}
        state="empty"
        data={emptyData}
        client={client}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Add a task…"), {
      target: { value: "  Buy milk  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(client.create).toHaveBeenCalledWith("inst-1", {
        title: "Buy milk",
        dueAt: null,
      });
    });
    expect(screen.getByText("Buy milk")).toBeTruthy();
    expect((screen.getByPlaceholderText("Add a task…") as HTMLInputElement).value).toBe("");
  });

  it("creates a task when Enter is pressed", async () => {
    const client = createMockClient();
    render(
      <TodoRenderer
        instanceId="inst-1"
        title="Todo"
        config={TODO_DEFAULT_CONFIG}
        state="empty"
        data={emptyData}
        client={client}
      />,
    );
    const input = screen.getByPlaceholderText("Add a task…");
    fireEvent.change(input, { target: { value: "Write docs" } });
    const form = input.closest("form");
    expect(form).toBeTruthy();
    if (!form) {
      return;
    }
    fireEvent.submit(form);
    await waitFor(() => {
      expect(client.create).toHaveBeenCalled();
    });
    expect(screen.getByText("Write docs")).toBeTruthy();
  });

  it("rejects an empty input with an accessible validation message", async () => {
    const client = createMockClient();
    render(
      <TodoRenderer
        instanceId="inst-1"
        title="Todo"
        config={TODO_DEFAULT_CONFIG}
        state="empty"
        data={emptyData}
        client={client}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/enter a task title/i);
    expect(client.create).not.toHaveBeenCalled();
  });

  it("restores the input when creation fails", async () => {
    const client = createMockClient({
      create: vi.fn(async () => {
        throw new Error("create failed");
      }),
    });
    render(
      <TodoRenderer
        instanceId="inst-1"
        title="Todo"
        config={TODO_DEFAULT_CONFIG}
        state="empty"
        data={emptyData}
        client={client}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Add a task…"), {
      target: { value: "Transient task" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toMatch(/create failed/i);
    });
    expect((screen.getByPlaceholderText("Add a task…") as HTMLInputElement).value).toBe(
      "Transient task",
    );
    expect(screen.queryByText("Transient task")).toBeNull();
  });

  it("rolls back optimistic complete when the API fails", async () => {
    const client = createMockClient({
      update: vi.fn(async () => {
        throw new Error("network down");
      }),
    });

    render(
      <TodoRenderer
        instanceId="1"
        title="Todo"
        config={TODO_DEFAULT_CONFIG}
        state="success"
        data={sampleData}
        client={client}
      />,
    );

    fireEvent.click(screen.getByLabelText("Complete Ship widgets"));
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toMatch(/network down/i);
    });
    expect(screen.getByLabelText("Complete Ship widgets")).toBeTruthy();
  });

  it("completes and reopens a task", async () => {
    const client = createMockClient({
      update: vi.fn(async (_instanceId, _itemId, input) => ({
        ...sampleItem,
        completed: Boolean(input.completed),
        updatedAt: new Date().toISOString(),
      })),
    });
    render(
      <TodoRenderer
        instanceId="1"
        title="Todo"
        config={TODO_DEFAULT_CONFIG}
        state="success"
        data={sampleData}
        client={client}
      />,
    );
    fireEvent.click(screen.getByLabelText("Complete Ship widgets"));
    await waitFor(() => {
      expect(screen.getByLabelText("Reopen Ship widgets")).toBeTruthy();
    });
    fireEvent.click(screen.getByLabelText("Reopen Ship widgets"));
    await waitFor(() => {
      expect(screen.getByLabelText("Complete Ship widgets")).toBeTruthy();
    });
  });

  it("edits a task title with Enter", async () => {
    const client = createMockClient();
    render(
      <TodoRenderer
        instanceId="1"
        title="Todo"
        config={TODO_DEFAULT_CONFIG}
        state="success"
        data={sampleData}
        client={client}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit Ship widgets" }));
    const edit = screen.getByLabelText("Edit Ship widgets");
    fireEvent.change(edit, { target: { value: "Ship widgets v2" } });
    fireEvent.keyDown(edit, { key: "Enter" });
    await waitFor(() => {
      expect(client.update).toHaveBeenCalledWith("1", sampleItem.id, {
        title: "Ship widgets v2",
      });
    });
  });

  it("deletes a task and offers undo", async () => {
    const client = createMockClient();
    render(
      <TodoRenderer
        instanceId="1"
        title="Todo"
        config={TODO_DEFAULT_CONFIG}
        state="success"
        data={sampleData}
        client={client}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete Ship widgets" }));
    await waitFor(() => {
      expect(client.remove).toHaveBeenCalledWith("1", sampleItem.id);
    });
    expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
  });

  it("reorders with move down", async () => {
    const second: TodoItem = {
      ...sampleItem,
      id: "55555555-5555-4555-8555-555555555555",
      title: "Second",
      sortOrder: 1,
    };
    const client = createMockClient();
    render(
      <TodoRenderer
        instanceId="1"
        title="Todo"
        config={TODO_DEFAULT_CONFIG}
        state="success"
        data={{ ...sampleData, items: [sampleItem, second] }}
        client={client}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Move Ship widgets down" }));
    await waitFor(() => {
      expect(client.reorder).toHaveBeenCalledWith("1", {
        orderedIds: [second.id, sampleItem.id],
      });
    });
  });
});

describe("TodoSettings", () => {
  it("renders view mode control", () => {
    render(<TodoSettings instanceId="1" config={TODO_DEFAULT_CONFIG} onChange={() => undefined} />);
    expect(screen.getByLabelText("View mode")).toBeTruthy();
  });
});
