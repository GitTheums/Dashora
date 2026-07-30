import type { FormEvent } from "react";
import type { WidgetSettingsProps } from "../../registry/types.js";
import { widgetFieldStyle, widgetInputStyle, widgetLabelStyle } from "../_shared/chrome.js";
import { type TodoConfig, type TodoViewMode, todoConfigSchema } from "./config.js";

export function TodoSettings({
  config,
  onChange,
  onSubmit,
  disabled = false,
}: WidgetSettingsProps<TodoConfig>) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.(todoConfigSchema.parse(config));
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Todo settings"
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="todo-view-mode">
          View mode
        </label>
        <select
          id="todo-view-mode"
          style={widgetInputStyle}
          value={config.viewMode}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...config, viewMode: event.target.value as TodoViewMode })
          }
        >
          <option value="detailed">Detailed</option>
          <option value="compact">Compact</option>
        </select>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input
          id="todo-show-completed"
          type="checkbox"
          checked={config.showCompleted}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, showCompleted: event.target.checked })}
        />
        <label style={widgetLabelStyle} htmlFor="todo-show-completed">
          Show completed tasks
        </label>
      </div>

      {onSubmit ? (
        <button type="submit" disabled={disabled}>
          Save settings
        </button>
      ) : null}
    </form>
  );
}
