import type { FormEvent } from "react";
import type { WidgetSettingsProps } from "../../registry/types.js";
import {
  widgetFieldStyle,
  widgetInputStyle,
  widgetLabelStyle,
  widgetMutedStyle,
} from "../_shared/chrome.js";
import {
  SEARCH_ENGINE_PRESETS,
  type SearchConfig,
  type SearchQuickLink,
  searchConfigSchema,
} from "./config.js";

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `a${Date.now().toString(16)}-1111-4111-8111-${Math.floor(Math.random() * 1e12)
    .toString(16)
    .padStart(12, "0")}`;
}

export function SearchSettings({
  config,
  onChange,
  onSubmit,
  disabled = false,
}: WidgetSettingsProps<SearchConfig>) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.(searchConfigSchema.parse(config));
  };

  const updateQuickLink = (id: string, patch: Partial<SearchQuickLink>) => {
    onChange({
      ...config,
      quickLinks: config.quickLinks.map((link) => (link.id === id ? { ...link, ...patch } : link)),
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Search settings"
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="search-engine">
          Search engine
        </label>
        <select
          id="search-engine"
          style={widgetInputStyle}
          value={config.engine}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...config,
              engine: event.target.value as SearchConfig["engine"],
            })
          }
        >
          {Object.values(SEARCH_ENGINE_PRESETS).map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
          <option value="custom">Custom template</option>
        </select>
      </div>

      {config.engine === "custom" ? (
        <div style={widgetFieldStyle}>
          <label style={widgetLabelStyle} htmlFor="search-template">
            Custom URL template
          </label>
          <input
            id="search-template"
            style={widgetInputStyle}
            value={config.customTemplate ?? ""}
            disabled={disabled}
            placeholder="https://example.com/search?q={query}"
            onChange={(event) => onChange({ ...config, customTemplate: event.target.value })}
          />
          <p style={widgetMutedStyle}>Must be https/http and include {"{query}"}.</p>
        </div>
      ) : null}

      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="search-shortcut">
          Keyboard shortcut
        </label>
        <input
          id="search-shortcut"
          style={widgetInputStyle}
          value={config.keyboardShortcut}
          disabled={disabled}
          placeholder="/ or Ctrl+K"
          onChange={(event) => onChange({ ...config, keyboardShortcut: event.target.value })}
        />
      </div>

      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="search-placeholder">
          Placeholder
        </label>
        <input
          id="search-placeholder"
          style={widgetInputStyle}
          value={config.placeholder}
          disabled={disabled}
          maxLength={80}
          onChange={(event) => onChange({ ...config, placeholder: event.target.value })}
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input
          id="search-new-tab"
          type="checkbox"
          checked={config.openInNewTab}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, openInNewTab: event.target.checked })}
        />
        <label style={widgetLabelStyle} htmlFor="search-new-tab">
          Open results in a new tab
        </label>
      </div>

      <fieldset
        style={{ border: "1px solid var(--ds-border)", borderRadius: "0.5rem", padding: "0.75rem" }}
      >
        <legend style={widgetLabelStyle}>Quick links</legend>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {config.quickLinks.map((link) => (
            <div key={link.id} style={{ display: "grid", gap: "0.35rem" }}>
              <input
                style={widgetInputStyle}
                aria-label="Quick link label"
                value={link.label}
                disabled={disabled}
                onChange={(event) => updateQuickLink(link.id, { label: event.target.value })}
              />
              <input
                style={widgetInputStyle}
                aria-label="Quick link URL"
                value={link.url}
                disabled={disabled}
                onChange={(event) => updateQuickLink(link.id, { url: event.target.value })}
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  onChange({
                    ...config,
                    quickLinks: config.quickLinks.filter((entry) => entry.id !== link.id),
                  })
                }
              >
                Remove link
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={disabled || config.quickLinks.length >= 12}
            onClick={() =>
              onChange({
                ...config,
                quickLinks: [
                  ...config.quickLinks,
                  { id: newId(), label: "Link", url: "https://example.com" },
                ],
              })
            }
          >
            Add quick link
          </button>
        </div>
      </fieldset>

      {onSubmit ? (
        <button type="submit" disabled={disabled}>
          Save settings
        </button>
      ) : null}
    </form>
  );
}
