import type { CSSProperties, ReactNode } from "react";
import type { WidgetRendererProps } from "../../registry/types.js";
import type { DemoMetricsConfig, DemoMetricsData } from "./config.js";

const shellStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
  minHeight: "8rem",
  color: "var(--ds-fg, inherit)",
  fontFamily: "var(--ds-font-sans, inherit)",
};

const bannerStyle: CSSProperties = {
  margin: 0,
  padding: "0.5rem 0.75rem",
  borderRadius: "var(--ds-radius-md, 0.5rem)",
  background: "var(--ds-warning-muted, rgba(184, 106, 20, 0.1))",
  color: "var(--ds-warning, #b86a14)",
  fontSize: "0.8125rem",
};

const mutedStyle: CSSProperties = {
  margin: 0,
  color: "var(--ds-fg-muted, #55606c)",
  fontSize: "0.875rem",
};

const valueStyle: CSSProperties = {
  margin: 0,
  fontSize: "1.75rem",
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
  lineHeight: 1.2,
};

const labelStyle: CSSProperties = {
  margin: 0,
  color: "var(--ds-fg-muted, #55606c)",
  fontSize: "0.8125rem",
};

function Skeleton() {
  return (
    <div style={shellStyle} aria-busy="true" aria-live="polite">
      <div
        style={{
          height: "0.875rem",
          width: "40%",
          borderRadius: "0.25rem",
          background: "var(--ds-surface-3, #e3e8ed)",
        }}
      />
      <div
        style={{
          height: "2rem",
          width: "55%",
          borderRadius: "0.25rem",
          background: "var(--ds-surface-3, #e3e8ed)",
        }}
      />
    </div>
  );
}

function MetricsBody({ data }: { data: DemoMetricsData }) {
  const overThreshold = data.value >= data.warningThreshold;
  return (
    <div style={shellStyle}>
      <p style={labelStyle}>{data.label}</p>
      <p
        style={{
          ...valueStyle,
          color: overThreshold ? "var(--ds-warning, #b86a14)" : "var(--ds-fg, inherit)",
        }}
      >
        {data.value}
      </p>
      <p style={mutedStyle}>
        Threshold {data.warningThreshold} · updated{" "}
        <time dateTime={data.generatedAt}>{new Date(data.generatedAt).toLocaleString()}</time>
      </p>
    </div>
  );
}

/**
 * Client renderer covering every required widget runtime state.
 */
export function DemoMetricsRenderer({
  title,
  state,
  data,
  message,
  onRefresh,
}: WidgetRendererProps<DemoMetricsData, DemoMetricsConfig>) {
  const typedData = data;

  let body: ReactNode;
  switch (state) {
    case "loading":
      body = <Skeleton />;
      break;
    case "refreshing":
      body = (
        <div style={shellStyle}>
          <output style={bannerStyle}>{message ?? "Refreshing…"}</output>
          {typedData ? <MetricsBody data={typedData} /> : <Skeleton />}
        </div>
      );
      break;
    case "success":
      body = typedData ? (
        <MetricsBody data={typedData} />
      ) : (
        <p style={mutedStyle}>No metric payload.</p>
      );
      break;
    case "empty":
      body = (
        <div style={shellStyle}>
          <p style={{ ...valueStyle, fontSize: "1rem" }}>Nothing here yet</p>
          <p style={mutedStyle}>{message ?? "There is no content to show for this widget."}</p>
        </div>
      );
      break;
    case "stale":
      body = (
        <div style={shellStyle}>
          <output style={bannerStyle}>
            {message ?? "Showing last good data while a refresh is overdue."}
          </output>
          {typedData ? <MetricsBody data={typedData} /> : null}
        </div>
      );
      break;
    case "error":
      body = (
        <div style={shellStyle} role="alert">
          <p style={{ ...valueStyle, fontSize: "1rem", color: "var(--ds-danger, #c43c3c)" }}>
            Could not load data
          </p>
          <p style={mutedStyle}>{message ?? "Something went wrong."}</p>
          {onRefresh ? (
            <button type="button" onClick={onRefresh}>
              Retry
            </button>
          ) : null}
        </div>
      );
      break;
    case "disabled":
      body = (
        <div style={shellStyle}>
          <p style={{ ...valueStyle, fontSize: "1rem" }}>Widget disabled</p>
          <p style={mutedStyle}>{message ?? "Turn this widget on to start showing data."}</p>
        </div>
      );
      break;
    case "configuration-required":
      body = (
        <div style={shellStyle}>
          <p style={{ ...valueStyle, fontSize: "1rem" }}>Configuration required</p>
          <p style={mutedStyle}>
            {message ?? "Add the missing settings before this widget can run."}
          </p>
        </div>
      );
      break;
  }

  return (
    <section
      aria-label={title}
      data-widget="demo-metrics"
      data-state={state}
      style={{
        padding: "1rem",
        borderRadius: "var(--ds-radius-lg, 0.75rem)",
        border: "1px solid var(--ds-border, rgba(18, 23, 28, 0.1))",
        background: "var(--ds-surface-1, #fbfcfd)",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
          marginBottom: "0.75rem",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "1rem",
            fontWeight: 600,
          }}
        >
          {title}
        </h2>
        {onRefresh && state !== "disabled" && state !== "configuration-required" ? (
          <button type="button" onClick={onRefresh} aria-label={`Refresh ${title}`}>
            Refresh
          </button>
        ) : null}
      </header>
      {body}
    </section>
  );
}
