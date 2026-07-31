import type { ReactNode } from "react";
import type { WidgetRendererProps } from "../../registry/types.js";
import {
  WidgetFrame,
  widgetBannerStyle,
  widgetMutedStyle,
  widgetShellStyle,
} from "../_shared/chrome.js";
import { CustomApiBody, CustomApiSkeleton } from "./body.js";
import type { CustomApiConfig, CustomApiData } from "./config.js";
import { CUSTOM_API_WIDGET_ID } from "./definition.js";

export type CustomApiRendererProps = WidgetRendererProps<CustomApiData, CustomApiConfig>;

export function CustomApiRenderer({
  title,
  state,
  data,
  message,
  onRefresh,
}: CustomApiRendererProps) {
  let body: ReactNode;
  switch (state) {
    case "loading":
      body = <CustomApiSkeleton />;
      break;
    case "refreshing":
      body = (
        <div style={widgetShellStyle}>
          <output style={widgetBannerStyle}>{message ?? "Refreshing…"}</output>
          {data ? <CustomApiBody data={data} /> : <CustomApiSkeleton />}
        </div>
      );
      break;
    case "success":
      body = data ? <CustomApiBody data={data} /> : <p style={widgetMutedStyle}>No payload.</p>;
      break;
    case "empty":
      body = (
        <div style={widgetShellStyle}>
          <p style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Nothing here yet</p>
          <p style={widgetMutedStyle}>{message ?? "The mapped response was empty."}</p>
        </div>
      );
      break;
    case "stale":
      body = (
        <div style={widgetShellStyle}>
          <output style={widgetBannerStyle}>
            {message ?? "Showing last good data while a refresh is overdue."}
          </output>
          {data ? <CustomApiBody data={data} /> : null}
        </div>
      );
      break;
    case "error":
      body = (
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
      break;
    case "disabled":
      body = (
        <div style={widgetShellStyle}>
          <p style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Widget disabled</p>
          <p style={widgetMutedStyle}>{message ?? "Turn this widget on to start showing data."}</p>
        </div>
      );
      break;
    case "configuration-required":
      body = (
        <div style={widgetShellStyle}>
          <p style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Configuration required</p>
          <p style={widgetMutedStyle}>
            {message ?? "Complete setup in settings before this widget can run."}
          </p>
        </div>
      );
      break;
  }

  return (
    <WidgetFrame title={title} widgetId={CUSTOM_API_WIDGET_ID} state={state} onRefresh={onRefresh}>
      {body}
    </WidgetFrame>
  );
}
