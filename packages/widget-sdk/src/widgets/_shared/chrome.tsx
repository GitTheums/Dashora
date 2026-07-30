import type { CSSProperties, ReactNode } from "react";
import type { WidgetState } from "../../states.js";

export const widgetShellStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
  minHeight: "6rem",
  color: "var(--ds-fg, inherit)",
  fontFamily: "var(--ds-font-sans, inherit)",
};

export const widgetMutedStyle: CSSProperties = {
  margin: 0,
  color: "var(--ds-fg-muted, #55606c)",
  fontSize: "0.875rem",
};

export const widgetBannerStyle: CSSProperties = {
  margin: 0,
  padding: "0.5rem 0.75rem",
  borderRadius: "var(--ds-radius-md, 0.5rem)",
  background: "var(--ds-warning-muted, rgba(184, 106, 20, 0.1))",
  color: "var(--ds-warning, #b86a14)",
  fontSize: "0.8125rem",
};

export const widgetFieldStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.35rem",
};

export const widgetLabelStyle: CSSProperties = {
  fontSize: "0.8125rem",
  fontWeight: 500,
  color: "var(--ds-fg, inherit)",
};

export const widgetInputStyle: CSSProperties = {
  padding: "0.5rem 0.65rem",
  borderRadius: "var(--ds-radius-md, 0.5rem)",
  border: "1px solid var(--ds-border-strong, rgba(18, 23, 28, 0.18))",
  background: "var(--ds-surface-1, #fbfcfd)",
  color: "var(--ds-fg, inherit)",
  font: "inherit",
};

export function WidgetSkeleton({ label = "Loading…" }: { label?: string }) {
  return (
    <div style={widgetShellStyle} aria-busy="true" aria-live="polite" aria-label={label}>
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
          width: "70%",
          borderRadius: "0.25rem",
          background: "var(--ds-surface-3, #e3e8ed)",
        }}
      />
    </div>
  );
}

export function WidgetStateBody({
  state,
  message,
  onRefresh,
  children,
}: {
  state: WidgetState;
  message?: string | undefined;
  onRefresh?: (() => void) | undefined;
  children?: ReactNode;
}) {
  switch (state) {
    case "loading":
      return <WidgetSkeleton />;
    case "refreshing":
      return (
        <div style={widgetShellStyle}>
          <output style={widgetBannerStyle}>{message ?? "Refreshing…"}</output>
          {children ?? <WidgetSkeleton label="Refreshing…" />}
        </div>
      );
    case "success":
      return <>{children}</>;
    case "empty":
      return (
        <div style={widgetShellStyle}>
          <p style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Nothing here yet</p>
          <p style={widgetMutedStyle}>
            {message ?? "There is no content to show for this widget."}
          </p>
        </div>
      );
    case "stale":
      return (
        <div style={widgetShellStyle}>
          <output style={widgetBannerStyle}>
            {message ?? "Showing last good data while a refresh is overdue."}
          </output>
          {children}
        </div>
      );
    case "error":
      return (
        <div style={widgetShellStyle} role="alert">
          <p
            style={{
              margin: 0,
              fontSize: "1rem",
              fontWeight: 600,
              color: "var(--ds-danger, #c43c3c)",
            }}
          >
            Could not load data
          </p>
          <p style={widgetMutedStyle}>{message ?? "Something went wrong."}</p>
          {onRefresh ? (
            <button type="button" onClick={onRefresh}>
              Retry
            </button>
          ) : null}
        </div>
      );
    case "disabled":
      return (
        <div style={widgetShellStyle}>
          <p style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Widget disabled</p>
          <p style={widgetMutedStyle}>{message ?? "Turn this widget on to start showing data."}</p>
        </div>
      );
    case "configuration-required":
      return (
        <div style={widgetShellStyle}>
          <p style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Configuration required</p>
          <p style={widgetMutedStyle}>
            {message ?? "Add the missing settings before this widget can run."}
          </p>
        </div>
      );
  }
}

export function WidgetFrame({
  title,
  widgetId,
  state,
  onRefresh,
  children,
}: {
  title: string;
  widgetId: string;
  state: WidgetState;
  onRefresh?: (() => void) | undefined;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      data-widget={widgetId}
      data-state={state}
      style={{
        padding: "0.25rem 0",
        fontFamily: "var(--ds-font-sans, inherit)",
        color: "var(--ds-fg, inherit)",
      }}
    >
      {onRefresh && state !== "disabled" && state !== "configuration-required" ? (
        <span className="visually-hidden">
          <button type="button" onClick={onRefresh} aria-label={`Refresh ${title}`}>
            Refresh
          </button>
        </span>
      ) : null}
      {children}
    </section>
  );
}
