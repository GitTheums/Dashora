import { type FormEvent, useId } from "react";
import type { WidgetSettingsProps } from "../../registry/types.js";
import {
  widgetFieldStyle,
  widgetInputStyle,
  widgetLabelStyle,
  widgetMutedStyle,
} from "../_shared/chrome.js";
import { type IframeAspectRatio, type IframeConfig, iframeConfigSchema } from "./config.js";

export type IframeSettingsProps = WidgetSettingsProps<IframeConfig>;

export function IframeSettings({
  config,
  onChange,
  onSubmit,
  disabled = false,
}: IframeSettingsProps) {
  const urlId = useId();
  const titleId = useId();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.(iframeConfigSchema.parse(config));
  };

  const allowListText = config.allowList.join("\n");

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="iFrame settings"
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor={urlId}>
          Embed URL (https)
        </label>
        <input
          id={urlId}
          style={widgetInputStyle}
          value={config.url}
          disabled={disabled}
          placeholder="https://example.com/embed"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onChange({ ...config, url: event.target.value })}
        />
      </div>

      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor={titleId}>
          Frame title
        </label>
        <input
          id={titleId}
          style={widgetInputStyle}
          value={config.frameTitle}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, frameTitle: event.target.value })}
        />
      </div>

      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="iframe-aspect">
          Aspect ratio
        </label>
        <select
          id="iframe-aspect"
          style={widgetInputStyle}
          disabled={disabled}
          value={config.aspectRatio}
          onChange={(event) =>
            onChange({ ...config, aspectRatio: event.target.value as IframeAspectRatio })
          }
        >
          <option value="16:9">16:9</option>
          <option value="4:3">4:3</option>
          <option value="1:1">1:1</option>
          <option value="21:9">21:9</option>
          <option value="3:4">3:4</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      {config.aspectRatio === "custom" ? (
        <div style={widgetFieldStyle}>
          <label style={widgetLabelStyle} htmlFor="iframe-custom-aspect">
            Custom ratio (width ÷ height)
          </label>
          <input
            id="iframe-custom-aspect"
            style={widgetInputStyle}
            type="number"
            min={0.25}
            max={4}
            step={0.01}
            disabled={disabled}
            value={config.customAspectRatio}
            onChange={(event) =>
              onChange({
                ...config,
                customAspectRatio: Number.parseFloat(event.target.value) || 16 / 9,
              })
            }
          />
        </div>
      ) : null}

      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="iframe-allow-list">
          Host allow list (optional, one hostname per line)
        </label>
        <textarea
          id="iframe-allow-list"
          style={{
            ...widgetInputStyle,
            minHeight: "4.5rem",
            fontFamily: "var(--ds-font-mono, monospace)",
          }}
          disabled={disabled}
          placeholder={"example.com\n*.trusted.example"}
          value={allowListText}
          spellCheck={false}
          onChange={(event) =>
            onChange({
              ...config,
              allowList: event.target.value
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean),
            })
          }
        />
        <p style={widgetMutedStyle}>
          When set, only matching hosts can be embedded. Use `*.example.com` for subdomains.
        </p>
      </div>

      <fieldset
        style={{
          margin: 0,
          padding: "0.75rem",
          border: "1px solid var(--ds-border-strong, rgba(18, 23, 28, 0.18))",
          borderRadius: "var(--ds-radius-md, 0.5rem)",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        <legend style={{ ...widgetLabelStyle, padding: "0 0.25rem" }}>Sandbox permissions</legend>
        <p style={widgetMutedStyle}>
          Defaults are fully sandboxed. Enabling scripts and same-origin together weakens isolation
          — only do this for trusted embeds.
        </p>
        {(
          [
            ["allowScripts", "Allow scripts"],
            ["allowSameOrigin", "Allow same-origin"],
            ["allowForms", "Allow forms"],
            ["allowPopups", "Allow popups"],
            ["allowPopupsToEscapeSandbox", "Allow popups to escape sandbox"],
            ["allowDownloads", "Allow downloads"],
            ["allowModals", "Allow modals"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input
              type="checkbox"
              checked={config.sandbox[key]}
              disabled={disabled}
              onChange={(event) =>
                onChange({
                  ...config,
                  sandbox: { ...config.sandbox, [key]: event.target.checked },
                })
              }
            />
            {label}
          </label>
        ))}
      </fieldset>

      <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input
          type="checkbox"
          checked={config.enabled}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, enabled: event.target.checked })}
        />
        Enabled
      </label>

      <p style={widgetMutedStyle}>
        The iframe is sandboxed in the browser. Dashora does not widen the app
        Content-Security-Policy globally for embeds — keep allow lists tight and prefer trusted
        origins.
      </p>

      {onSubmit ? (
        <button type="submit" disabled={disabled}>
          Save
        </button>
      ) : null}
    </form>
  );
}
