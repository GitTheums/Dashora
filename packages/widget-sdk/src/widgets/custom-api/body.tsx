import type { CSSProperties } from "react";
import { widgetMutedStyle, widgetShellStyle } from "../_shared/chrome.js";
import type { CustomApiData, CustomApiStatusState } from "./config.js";

const statusColor: Record<CustomApiStatusState, string> = {
  ok: "var(--ds-success, #1f7a45)",
  warn: "var(--ds-warning, #b86a14)",
  error: "var(--ds-danger, #c43c3c)",
  unknown: "var(--ds-fg-muted, #55606c)",
};

const progressTrackStyle: CSSProperties = {
  height: "0.5rem",
  borderRadius: "999px",
  background: "var(--ds-surface-3, #e3e8ed)",
  overflow: "hidden",
};

export function CustomApiBody({ data }: { data: CustomApiData }) {
  const { presentation } = data;

  if (presentation.template === "text" && presentation.text) {
    return (
      <div style={widgetShellStyle}>
        <p style={{ margin: 0, fontSize: "1rem", lineHeight: 1.45, whiteSpace: "pre-wrap" }}>
          {presentation.text.content}
        </p>
        <p style={widgetMutedStyle}>HTTP {data.httpStatus}</p>
      </div>
    );
  }

  if (presentation.template === "metric" && presentation.metric) {
    return (
      <div style={widgetShellStyle}>
        {presentation.metric.label ? (
          <p style={{ ...widgetMutedStyle, fontWeight: 500 }}>{presentation.metric.label}</p>
        ) : null}
        <p style={{ margin: 0, fontSize: "1.75rem", fontWeight: 700, lineHeight: 1.1 }}>
          {presentation.metric.value}
          {presentation.metric.unit ? (
            <span style={{ ...widgetMutedStyle, marginLeft: "0.35rem", fontSize: "1rem" }}>
              {presentation.metric.unit}
            </span>
          ) : null}
        </p>
      </div>
    );
  }

  if (presentation.template === "list" && presentation.list) {
    return (
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: "0.65rem",
        }}
      >
        {presentation.list.items.map((item, index) => (
          <li
            key={`${item.title}-${index}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "0.75rem",
              alignItems: "baseline",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 600 }}>{item.title}</p>
              {item.subtitle ? <p style={widgetMutedStyle}>{item.subtitle}</p> : null}
            </div>
            {item.value ? (
              <span style={{ ...widgetMutedStyle, flexShrink: 0 }}>{item.value}</span>
            ) : null}
          </li>
        ))}
      </ul>
    );
  }

  if (presentation.template === "progress" && presentation.progress) {
    const pct = Math.max(
      0,
      Math.min(100, (presentation.progress.value / presentation.progress.max) * 100),
    );
    return (
      <div style={widgetShellStyle}>
        {presentation.progress.label ? (
          <p style={{ margin: 0, fontWeight: 600 }}>{presentation.progress.label}</p>
        ) : null}
        <progress
          style={{
            ...progressTrackStyle,
            width: "100%",
            accentColor: "var(--ds-primary, #2563eb)",
          }}
          max={presentation.progress.max}
          value={Math.min(presentation.progress.value, presentation.progress.max)}
          aria-label={presentation.progress.label ?? "Progress"}
        >
          {pct.toFixed(0)}%
        </progress>
        <p style={widgetMutedStyle}>
          {presentation.progress.value} / {presentation.progress.max}
        </p>
      </div>
    );
  }

  if (presentation.template === "status" && presentation.status) {
    const state = presentation.status.state;
    return (
      <div style={widgetShellStyle}>
        <p style={{ margin: 0, fontWeight: 700, color: statusColor[state] }}>
          {presentation.status.label}
        </p>
        {presentation.status.detail ? (
          <p style={widgetMutedStyle}>{presentation.status.detail}</p>
        ) : null}
        <p style={widgetMutedStyle}>State: {state}</p>
      </div>
    );
  }

  return <p style={widgetMutedStyle}>No presentation data.</p>;
}

export function CustomApiSkeleton() {
  return (
    <div style={widgetShellStyle} aria-busy="true" aria-live="polite" aria-label="Loading…">
      <div
        style={{
          height: "0.875rem",
          width: "35%",
          borderRadius: "0.25rem",
          background: "var(--ds-surface-3, #e3e8ed)",
        }}
      />
      <div
        style={{
          height: "1.75rem",
          width: "55%",
          borderRadius: "0.25rem",
          background: "var(--ds-surface-3, #e3e8ed)",
        }}
      />
    </div>
  );
}
