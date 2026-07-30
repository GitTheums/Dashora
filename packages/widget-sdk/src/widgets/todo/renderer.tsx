import { type FormEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import type { WidgetRendererProps } from "../../registry/types.js";
import {
  WidgetFrame,
  WidgetSkeleton,
  widgetInputStyle,
  widgetMutedStyle,
  widgetShellStyle,
} from "../_shared/chrome.js";
import { type TodoClient, defaultTodoClient } from "./client.js";
import { type TodoConfig, type TodoData, type TodoItem, filterVisibleTodoItems } from "./config.js";
import { TODO_WIDGET_ID } from "./definition.js";

const MAX_TITLE_LENGTH = 200;
const UNDO_MS = 6_000;

function newLocalId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `a${Date.now().toString(16)}-1111-4111-8111-${Math.floor(Math.random() * 1e12)
    .toString(16)
    .padStart(12, "0")}`;
}

function formatDue(dueAt: string | null): string | null {
  if (!dueAt) {
    return null;
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(dueAt));
  } catch {
    return null;
  }
}

function isOverdue(dueAt: string | null, completed: boolean): boolean {
  if (!dueAt || completed) {
    return false;
  }
  const due = Date.parse(dueAt);
  return Number.isFinite(due) && due < Date.now();
}

export type TodoRendererProps = WidgetRendererProps<TodoData, TodoConfig> & {
  client?: TodoClient;
};

export function TodoRenderer({
  instanceId,
  title,
  config,
  state,
  data,
  message,
  onRefresh,
  client = defaultTodoClient,
}: TodoRendererProps) {
  const inputId = useId();
  const validationId = `${inputId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<TodoItem[]>(data?.items ?? []);
  const [draft, setDraft] = useState("");
  const [dueDraft, setDueDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [undo, setUndo] = useState<{ item: TodoItem } | null>(null);
  const undoTimerRef = useRef<number | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    setItems(data?.items ?? []);
  }, [data?.items]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current !== null) {
        window.clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  const visible = filterVisibleTodoItems(items, config.showCompleted);
  const compact = config.viewMode === "compact";

  const runOptimistic = async (
    nextItems: TodoItem[],
    action: () => Promise<void>,
  ): Promise<boolean> => {
    const previous = items;
    setItems(nextItems);
    setActionError(null);
    setBusy(true);
    try {
      await action();
      return true;
    } catch (error) {
      setItems(previous);
      setActionError(error instanceof Error ? error.message : "Action failed");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const clearUndoTimer = () => {
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  };

  const onCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (submittingRef.current || busy) {
      return;
    }
    const titleText = draft.trim();
    if (!titleText) {
      setValidationError("Enter a task title.");
      inputRef.current?.focus();
      return;
    }
    if (titleText.length > MAX_TITLE_LENGTH) {
      setValidationError(`Task titles can be at most ${MAX_TITLE_LENGTH} characters.`);
      return;
    }
    setValidationError(null);
    const dueAt = dueDraft ? new Date(dueDraft).toISOString() : null;
    const previousDraft = draft;
    const previousDue = dueDraft;
    const optimistic: TodoItem = {
      id: newLocalId(),
      title: titleText,
      completed: false,
      dueAt,
      sortOrder: items.length === 0 ? 0 : Math.max(...items.map((item) => item.sortOrder)) + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    submittingRef.current = true;
    setDraft("");
    setDueDraft("");
    const ok = await runOptimistic([...items, optimistic], async () => {
      const created = await client.create(instanceId, {
        title: titleText,
        dueAt,
      });
      setItems((current) => current.map((item) => (item.id === optimistic.id ? created : item)));
    });
    submittingRef.current = false;
    if (!ok) {
      setDraft(previousDraft);
      setDueDraft(previousDue);
    }
  };

  const toggleComplete = async (item: TodoItem) => {
    if (busy) {
      return;
    }
    const nextCompleted = !item.completed;
    await runOptimistic(
      items.map((entry) =>
        entry.id === item.id
          ? { ...entry, completed: nextCompleted, updatedAt: new Date().toISOString() }
          : entry,
      ),
      async () => {
        const updated = await client.update(instanceId, item.id, { completed: nextCompleted });
        setItems((current) => current.map((entry) => (entry.id === item.id ? updated : entry)));
      },
    );
  };

  const startEdit = (item: TodoItem) => {
    setEditingId(item.id);
    setEditDraft(item.title);
    setValidationError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };

  const saveEdit = async (item: TodoItem) => {
    const nextTitle = editDraft.trim();
    if (!nextTitle) {
      setValidationError("Task title cannot be empty.");
      return;
    }
    if (nextTitle === item.title) {
      cancelEdit();
      return;
    }
    const previousTitle = item.title;
    setEditingId(null);
    const ok = await runOptimistic(
      items.map((entry) =>
        entry.id === item.id
          ? { ...entry, title: nextTitle, updatedAt: new Date().toISOString() }
          : entry,
      ),
      async () => {
        const updated = await client.update(instanceId, item.id, { title: nextTitle });
        setItems((current) => current.map((entry) => (entry.id === item.id ? updated : entry)));
      },
    );
    if (!ok) {
      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, title: previousTitle } : entry)),
      );
      setEditingId(item.id);
      setEditDraft(previousTitle);
    }
  };

  const onEditKeyDown = (event: KeyboardEvent<HTMLInputElement>, item: TodoItem) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      void saveEdit(item);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      cancelEdit();
    }
  };

  const removeItem = async (item: TodoItem) => {
    if (busy) {
      return;
    }
    clearUndoTimer();
    const ok = await runOptimistic(
      items.filter((entry) => entry.id !== item.id),
      async () => {
        await client.remove(instanceId, item.id);
      },
    );
    if (ok) {
      setUndo({ item });
      undoTimerRef.current = window.setTimeout(() => {
        setUndo(null);
        undoTimerRef.current = null;
      }, UNDO_MS);
    }
  };

  const undoDelete = async () => {
    if (!undo || busy) {
      return;
    }
    const restored = undo.item;
    clearUndoTimer();
    setUndo(null);
    const optimistic: TodoItem = {
      ...restored,
      id: newLocalId(),
      updatedAt: new Date().toISOString(),
    };
    const ok = await runOptimistic(
      [...items, optimistic].sort((a, b) => a.sortOrder - b.sortOrder),
      async () => {
        const created = await client.create(instanceId, {
          title: restored.title,
          dueAt: restored.dueAt,
        });
        let finalItem = created;
        if (restored.completed) {
          finalItem = await client.update(instanceId, created.id, { completed: true });
        }
        setItems((current) =>
          current.map((entry) => (entry.id === optimistic.id ? finalItem : entry)),
        );
      },
    );
    if (!ok) {
      setUndo({ item: restored });
    }
  };

  const moveItem = async (itemId: string, direction: -1 | 1) => {
    if (busy) {
      return;
    }
    const ordered = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
    const index = ordered.findIndex((item) => item.id === itemId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) {
      return;
    }
    const swapped = [...ordered];
    const temp = swapped[index];
    const other = swapped[target];
    if (!temp || !other) {
      return;
    }
    swapped[index] = other;
    swapped[target] = temp;
    const reindexed = swapped.map((item, sortOrder) => ({ ...item, sortOrder }));
    await runOptimistic(reindexed, async () => {
      const saved = await client.reorder(instanceId, {
        orderedIds: reindexed.map((item) => item.id),
      });
      setItems(saved);
    });
  };

  const stopGridDrag = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
  };

  if (state === "loading") {
    return (
      <WidgetFrame title={title} widgetId={TODO_WIDGET_ID} state={state} onRefresh={onRefresh}>
        <WidgetSkeleton label="Loading tasks…" />
      </WidgetFrame>
    );
  }

  if (state === "error") {
    return (
      <WidgetFrame title={title} widgetId={TODO_WIDGET_ID} state={state} onRefresh={onRefresh}>
        <div style={widgetShellStyle} role="alert" className="todo-widget">
          <p style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "var(--ds-danger)" }}>
            Could not load tasks
          </p>
          <p style={widgetMutedStyle}>{message ?? "Something went wrong."}</p>
          {onRefresh ? (
            <button type="button" onClick={onRefresh}>
              Retry
            </button>
          ) : null}
        </div>
      </WidgetFrame>
    );
  }

  if (state === "disabled") {
    return (
      <WidgetFrame title={title} widgetId={TODO_WIDGET_ID} state={state} onRefresh={onRefresh}>
        <div style={widgetShellStyle} className="todo-widget">
          <p style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Widget disabled</p>
          <p style={widgetMutedStyle}>{message ?? "Turn this widget on to manage tasks."}</p>
        </div>
      </WidgetFrame>
    );
  }

  if (state === "configuration-required") {
    return (
      <WidgetFrame title={title} widgetId={TODO_WIDGET_ID} state={state} onRefresh={onRefresh}>
        <div style={widgetShellStyle} className="todo-widget">
          <p style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Configuration required</p>
          <p style={widgetMutedStyle}>{message ?? "Finish setup in settings."}</p>
        </div>
      </WidgetFrame>
    );
  }

  return (
    <WidgetFrame title={title} widgetId={TODO_WIDGET_ID} state={state} onRefresh={onRefresh}>
      <div
        className="todo-widget"
        style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        onMouseDown={stopGridDrag}
        onTouchStart={stopGridDrag}
      >
        {state === "refreshing" || state === "stale" ? (
          <output
            style={{
              margin: 0,
              padding: "0.35rem 0.5rem",
              borderRadius: "var(--ds-radius-md, 0.5rem)",
              background: "var(--ds-warning-muted, rgba(184, 106, 20, 0.1))",
              color: "var(--ds-warning, #b86a14)",
              fontSize: "0.8125rem",
            }}
          >
            {message ?? (state === "refreshing" ? "Refreshing…" : "Showing last good data.")}
          </output>
        ) : null}

        <form
          onSubmit={onCreate}
          aria-label="Add task"
          className="todo-widget__composer"
          style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
        >
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <label htmlFor={inputId} className="visually-hidden">
              Task title
            </label>
            <input
              ref={inputRef}
              id={inputId}
              className="todo-widget__input"
              style={{ ...widgetInputStyle, flex: "1 1 10rem", minWidth: "8rem" }}
              value={draft}
              disabled={busy}
              placeholder="Add a task…"
              maxLength={MAX_TITLE_LENGTH}
              aria-invalid={validationError ? true : undefined}
              aria-describedby={validationError ? validationId : undefined}
              onChange={(event) => {
                setDraft(event.target.value);
                if (validationError) {
                  setValidationError(null);
                }
              }}
            />
            <button type="submit" className="todo-widget__add" disabled={busy}>
              Add
            </button>
          </div>
          {validationError ? (
            <p
              id={validationId}
              role="alert"
              style={{ ...widgetMutedStyle, color: "var(--ds-danger)" }}
            >
              {validationError}
            </p>
          ) : null}
          {!compact ? (
            <div>
              <label htmlFor={`${inputId}-due`} style={widgetMutedStyle}>
                Due date (optional)
              </label>
              <input
                id={`${inputId}-due`}
                className="todo-widget__due"
                style={{ ...widgetInputStyle, marginTop: "0.25rem", width: "100%" }}
                type="datetime-local"
                value={dueDraft}
                disabled={busy}
                onChange={(event) => setDueDraft(event.target.value)}
              />
            </div>
          ) : null}
        </form>

        {actionError ? (
          <p role="alert" style={{ ...widgetMutedStyle, color: "var(--ds-danger, #c43c3c)" }}>
            {actionError}
          </p>
        ) : null}

        {undo ? (
          <output
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              flexWrap: "wrap",
              padding: "0.4rem 0.55rem",
              borderRadius: "var(--ds-radius-md, 0.5rem)",
              background: "var(--ds-surface-2, #eef2f5)",
              border: "1px solid var(--ds-border)",
            }}
          >
            <span style={{ fontSize: "0.8125rem" }}>Deleted “{undo.item.title}”.</span>
            <button type="button" onClick={() => void undoDelete()} disabled={busy}>
              Undo
            </button>
          </output>
        ) : null}

        {visible.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <p style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600 }}>Nothing here yet</p>
            <p style={widgetMutedStyle}>
              {config.showCompleted
                ? "Your completed and upcoming tasks will appear here."
                : (message ??
                  "No open tasks. Turn on completed tasks in settings to review finished work.")}
            </p>
          </div>
        ) : (
          <ul
            className="todo-widget__list"
            style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.4rem" }}
          >
            {visible.map((item) => {
              const dueLabel = formatDue(item.dueAt);
              const overdue = isOverdue(item.dueAt, item.completed);
              const isEditing = editingId === item.id;
              return (
                <li
                  key={item.id}
                  className="todo-task"
                  data-completed={item.completed ? "true" : "false"}
                  style={{
                    display: "flex",
                    gap: "0.5rem",
                    alignItems: compact || isEditing ? "center" : "flex-start",
                    padding: "0.45rem 0.5rem",
                    borderRadius: "var(--ds-radius-md, 0.5rem)",
                    background: "var(--ds-surface-2, #eef2f5)",
                    border: "1px solid var(--ds-border, rgba(18, 23, 28, 0.1))",
                  }}
                >
                  <input
                    type="checkbox"
                    className="todo-task__checkbox"
                    checked={item.completed}
                    disabled={busy || isEditing}
                    aria-label={item.completed ? `Reopen ${item.title}` : `Complete ${item.title}`}
                    onChange={() => {
                      void toggleComplete(item);
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isEditing ? (
                      <input
                        className="todo-task__edit"
                        style={{ ...widgetInputStyle, width: "100%" }}
                        value={editDraft}
                        maxLength={MAX_TITLE_LENGTH}
                        aria-label={`Edit ${item.title}`}
                        onChange={(event) => setEditDraft(event.target.value)}
                        onKeyDown={(event) => onEditKeyDown(event, item)}
                      />
                    ) : (
                      <>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.875rem",
                            fontWeight: 500,
                            textDecoration: item.completed ? "line-through" : "none",
                            color: item.completed ? "var(--ds-fg-muted, #55606c)" : "inherit",
                          }}
                        >
                          {item.title}
                          {item.completed ? (
                            <span className="visually-hidden"> (completed)</span>
                          ) : null}
                        </p>
                        {!compact && dueLabel ? (
                          <p
                            style={{
                              ...widgetMutedStyle,
                              fontSize: "0.75rem",
                              color: overdue ? "var(--ds-danger)" : undefined,
                            }}
                          >
                            {overdue ? "Overdue · " : "Due "}
                            {dueLabel}
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>
                  <div className="todo-task__actions" style={{ display: "flex", gap: "0.25rem" }}>
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          aria-label={`Save ${item.title}`}
                          disabled={busy}
                          onClick={() => {
                            void saveEdit(item);
                          }}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          aria-label={`Cancel editing ${item.title}`}
                          onClick={cancelEdit}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="todo-task__move"
                          aria-label={`Move ${item.title} up`}
                          disabled={busy}
                          onClick={() => {
                            void moveItem(item.id, -1);
                          }}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="todo-task__move"
                          aria-label={`Move ${item.title} down`}
                          disabled={busy}
                          onClick={() => {
                            void moveItem(item.id, 1);
                          }}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          aria-label={`Edit ${item.title}`}
                          disabled={busy}
                          onClick={() => startEdit(item)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${item.title}`}
                          disabled={busy}
                          onClick={() => {
                            void removeItem(item);
                          }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </WidgetFrame>
  );
}
