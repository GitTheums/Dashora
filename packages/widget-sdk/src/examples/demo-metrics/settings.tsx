import type { FormEvent } from "react";
import type { WidgetSettingsProps } from "../../registry/types.js";
import type { WidgetState } from "../../states.js";
import type { DemoMetricsConfig } from "./config.js";
import { demoMetricsConfigSchema } from "./config.js";

const FORCE_STATE_OPTIONS: Array<WidgetState | ""> = [
  "",
  "loading",
  "refreshing",
  "success",
  "empty",
  "stale",
  "error",
  "disabled",
  "configuration-required",
];

const fieldStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "0.35rem",
};

const labelStyle = {
  fontSize: "0.8125rem",
  fontWeight: 500,
  color: "var(--ds-fg, inherit)",
};

const inputStyle = {
  padding: "0.5rem 0.65rem",
  borderRadius: "var(--ds-radius-md, 0.5rem)",
  border: "1px solid var(--ds-border-strong, rgba(18, 23, 28, 0.18))",
  background: "var(--ds-surface-1, #fbfcfd)",
  color: "var(--ds-fg, inherit)",
  font: "inherit",
};

/**
 * Settings form for the demo-metrics widget.
 */
export function DemoMetricsSettings({
  config,
  onChange,
  onSubmit,
  disabled = false,
}: WidgetSettingsProps<DemoMetricsConfig>) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = demoMetricsConfigSchema.parse(config);
    onSubmit?.(parsed);
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Demo metrics settings"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        fontFamily: "var(--ds-font-sans, inherit)",
      }}
    >
      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="demo-metrics-label">
          Metric label
        </label>
        <input
          id="demo-metrics-label"
          style={inputStyle}
          value={config.metricLabel}
          disabled={disabled}
          maxLength={40}
          onChange={(event) => onChange({ ...config, metricLabel: event.target.value })}
        />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="demo-metrics-threshold">
          Warning threshold
        </label>
        <input
          id="demo-metrics-threshold"
          style={inputStyle}
          type="number"
          min={0}
          max={1_000_000}
          value={config.warningThreshold}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...config,
              warningThreshold: Number(event.target.value),
            })
          }
        />
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="demo-metrics-seed">
          Seed value
        </label>
        <input
          id="demo-metrics-seed"
          style={inputStyle}
          type="number"
          min={0}
          max={10_000}
          value={config.seedValue}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...config,
              seedValue: Number(event.target.value),
            })
          }
        />
        <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--ds-fg-muted, #55606c)" }}>
          Set to 0 to preview the empty state without forceState.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <input
          id="demo-metrics-enabled"
          type="checkbox"
          checked={config.enabled}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, enabled: event.target.checked })}
        />
        <label style={labelStyle} htmlFor="demo-metrics-enabled">
          Enabled
        </label>
      </div>

      <div style={fieldStyle}>
        <label style={labelStyle} htmlFor="demo-metrics-force-state">
          Force state (developer)
        </label>
        <select
          id="demo-metrics-force-state"
          style={inputStyle}
          value={config.forceState ?? ""}
          disabled={disabled}
          onChange={(event) => {
            const value = event.target.value as WidgetState | "";
            if (value === "") {
              const { forceState: _removed, ...rest } = config;
              onChange(rest);
              return;
            }
            onChange({ ...config, forceState: value });
          }}
        >
          {FORCE_STATE_OPTIONS.map((option) => (
            <option key={option || "none"} value={option}>
              {option === "" ? "Automatic" : option}
            </option>
          ))}
        </select>
      </div>

      {onSubmit ? (
        <button type="submit" disabled={disabled}>
          Save settings
        </button>
      ) : null}
    </form>
  );
}
