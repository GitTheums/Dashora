import type { DragEvent, FormEvent } from "react";
import type { WidgetSettingsProps } from "../../registry/types.js";
import {
  widgetFieldStyle,
  widgetInputStyle,
  widgetLabelStyle,
  widgetMutedStyle,
} from "../_shared/chrome.js";
import {
  type BookmarkColorToken,
  type BookmarkGroup,
  type BookmarkIcon,
  type BookmarkItem,
  type BookmarksConfig,
  bookmarksConfigSchema,
  reorderBookmarkItems,
} from "./config.js";

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `a${Date.now().toString(16)}-1111-4111-8111-${Math.floor(Math.random() * 1e12)
    .toString(16)
    .padStart(12, "0")}`;
}

const COLOR_OPTIONS: BookmarkColorToken[] = [
  "primary",
  "secondary",
  "success",
  "warning",
  "danger",
  "muted",
];

const ICON_OPTIONS: BookmarkIcon[] = [
  "link",
  "home",
  "book",
  "cloud",
  "mail",
  "code",
  "globe",
  "star",
];

export function BookmarksSettings({
  config,
  onChange,
  onSubmit,
  disabled = false,
}: WidgetSettingsProps<BookmarksConfig>) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.(bookmarksConfigSchema.parse(config));
  };

  const updateGroup = (groupId: string, patch: Partial<BookmarkGroup>) => {
    onChange({
      ...config,
      groups: config.groups.map((group) => (group.id === groupId ? { ...group, ...patch } : group)),
    });
  };

  const updateItem = (groupId: string, itemId: string, patch: Partial<BookmarkItem>) => {
    onChange({
      ...config,
      groups: config.groups.map((group) => {
        if (group.id !== groupId) {
          return group;
        }
        return {
          ...group,
          items: group.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
        };
      }),
    });
  };

  const onDragStart = (event: DragEvent<HTMLLIElement>, groupId: string, index: number) => {
    event.dataTransfer.setData("text/plain", JSON.stringify({ groupId, index }));
    event.dataTransfer.effectAllowed = "move";
  };

  const onDrop = (event: DragEvent<HTMLLIElement>, groupId: string, toIndex: number) => {
    event.preventDefault();
    try {
      const raw = event.dataTransfer.getData("text/plain");
      const parsed = JSON.parse(raw) as { groupId?: string; index?: number };
      if (parsed.groupId !== groupId || typeof parsed.index !== "number") {
        return;
      }
      onChange({
        ...config,
        groups: reorderBookmarkItems(config.groups, groupId, parsed.index, toIndex),
      });
    } catch {
      // ignore invalid drag payloads
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Bookmarks settings"
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input
          id="bookmarks-new-tab"
          type="checkbox"
          checked={config.openInNewTab}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, openInNewTab: event.target.checked })}
        />
        <label style={widgetLabelStyle} htmlFor="bookmarks-new-tab">
          Open links in a new tab
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input
          id="bookmarks-descriptions"
          type="checkbox"
          checked={config.showDescriptions}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, showDescriptions: event.target.checked })}
        />
        <label style={widgetLabelStyle} htmlFor="bookmarks-descriptions">
          Show descriptions
        </label>
      </div>

      {config.groups.map((group) => (
        <fieldset
          key={group.id}
          style={{
            border: "1px solid var(--ds-border)",
            borderRadius: "0.5rem",
            padding: "0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <legend style={widgetLabelStyle}>{group.name || "Group"}</legend>
          <div style={widgetFieldStyle}>
            <label style={widgetLabelStyle} htmlFor={`group-name-${group.id}`}>
              Group name
            </label>
            <input
              id={`group-name-${group.id}`}
              style={widgetInputStyle}
              value={group.name}
              disabled={disabled}
              onChange={(event) => updateGroup(group.id, { name: event.target.value })}
            />
          </div>
          <div style={widgetFieldStyle}>
            <label style={widgetLabelStyle} htmlFor={`group-color-${group.id}`}>
              Color token
            </label>
            <select
              id={`group-color-${group.id}`}
              style={widgetInputStyle}
              value={group.color}
              disabled={disabled}
              onChange={(event) =>
                updateGroup(group.id, { color: event.target.value as BookmarkColorToken })
              }
            >
              {COLOR_OPTIONS.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
          </div>

          <p style={widgetMutedStyle}>Drag links to reorder within this group.</p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.75rem" }}>
            {group.items.map((item, index) => (
              <li
                key={item.id}
                draggable={!disabled}
                onDragStart={(event) => onDragStart(event, group.id, index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => onDrop(event, group.id, index)}
                style={{
                  display: "grid",
                  gap: "0.35rem",
                  padding: "0.5rem",
                  borderRadius: "0.5rem",
                  background: "var(--ds-surface-2)",
                  cursor: disabled ? "default" : "grab",
                }}
              >
                <span style={widgetMutedStyle}>Drag handle · position {index + 1}</span>
                <input
                  style={widgetInputStyle}
                  aria-label="Bookmark title"
                  value={item.title}
                  disabled={disabled}
                  onChange={(event) => updateItem(group.id, item.id, { title: event.target.value })}
                />
                <input
                  style={widgetInputStyle}
                  aria-label="Bookmark URL"
                  value={item.url}
                  disabled={disabled}
                  onChange={(event) => updateItem(group.id, item.id, { url: event.target.value })}
                />
                <input
                  style={widgetInputStyle}
                  aria-label="Bookmark description"
                  value={item.description ?? ""}
                  disabled={disabled}
                  onChange={(event) =>
                    updateItem(group.id, item.id, { description: event.target.value })
                  }
                />
                <select
                  style={widgetInputStyle}
                  aria-label="Bookmark icon"
                  value={item.icon}
                  disabled={disabled}
                  onChange={(event) =>
                    updateItem(group.id, item.id, { icon: event.target.value as BookmarkIcon })
                  }
                >
                  {ICON_OPTIONS.map((icon) => (
                    <option key={icon} value={icon}>
                      {icon}
                    </option>
                  ))}
                </select>
                <div style={{ display: "flex", gap: "0.35rem" }}>
                  <button
                    type="button"
                    disabled={disabled || index === 0}
                    aria-label={`Move ${item.title} up`}
                    onClick={() =>
                      onChange({
                        ...config,
                        groups: reorderBookmarkItems(config.groups, group.id, index, index - 1),
                      })
                    }
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={disabled || index >= group.items.length - 1}
                    aria-label={`Move ${item.title} down`}
                    onClick={() =>
                      onChange({
                        ...config,
                        groups: reorderBookmarkItems(config.groups, group.id, index, index + 1),
                      })
                    }
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() =>
                      updateGroup(group.id, {
                        items: group.items.filter((entry) => entry.id !== item.id),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              updateGroup(group.id, {
                items: [
                  ...group.items,
                  {
                    id: newId(),
                    title: "New link",
                    url: "https://example.com",
                    description: "",
                    icon: "link",
                  },
                ],
              })
            }
          >
            Add bookmark
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              onChange({
                ...config,
                groups: config.groups.filter((entry) => entry.id !== group.id),
              })
            }
          >
            Remove group
          </button>
        </fieldset>
      ))}

      <button
        type="button"
        disabled={disabled || config.groups.length >= 20}
        onClick={() =>
          onChange({
            ...config,
            groups: [...config.groups, { id: newId(), name: "Group", color: "primary", items: [] }],
          })
        }
      >
        Add group
      </button>

      {onSubmit ? (
        <button type="submit" disabled={disabled}>
          Save settings
        </button>
      ) : null}
    </form>
  );
}
