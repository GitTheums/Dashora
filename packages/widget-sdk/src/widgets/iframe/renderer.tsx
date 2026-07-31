import type { ReactNode } from "react";
import type { WidgetRendererProps } from "../../registry/types.js";
import {
  WidgetFrame,
  widgetBannerStyle,
  widgetMutedStyle,
  widgetShellStyle,
} from "../_shared/chrome.js";
import { IframeBody, IframeSkeleton } from "./body.js";
import type { IframeConfig, IframeData } from "./config.js";
import { resolveIframeAspectRatio } from "./config.js";
import { IFRAME_WIDGET_ID } from "./definition.js";

export type IframeRendererProps = WidgetRendererProps<IframeData, IframeConfig>;

export function IframeRenderer({
  title,
  config,
  state,
  data,
  message,
  onRefresh,
}: IframeRendererProps) {
  const aspectRatio = resolveIframeAspectRatio(config);
  let body: ReactNode;
  switch (state) {
    case "loading":
      body = <IframeSkeleton aspectRatio={aspectRatio} />;
      break;
    case "refreshing":
      body = (
        <div style={widgetShellStyle}>
          <output style={widgetBannerStyle}>{message ?? "Refreshing…"}</output>
          {data ? <IframeBody data={data} /> : <IframeSkeleton aspectRatio={aspectRatio} />}
        </div>
      );
      break;
    case "success":
      body = data ? (
        <IframeBody data={data} />
      ) : (
        <p style={widgetMutedStyle}>No embed configured.</p>
      );
      break;
    case "empty":
      body = (
        <div style={widgetShellStyle}>
          <p style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Nothing here yet</p>
          <p style={widgetMutedStyle}>{message ?? "Configure an https URL in settings."}</p>
        </div>
      );
      break;
    case "stale":
      body = (
        <div style={widgetShellStyle}>
          <output style={widgetBannerStyle}>
            {message ?? "Showing last good embed metadata while a refresh is overdue."}
          </output>
          {data ? <IframeBody data={data} /> : null}
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
            Could not load embed
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
          <p style={widgetMutedStyle}>{message ?? "Turn this widget on to show the embed."}</p>
        </div>
      );
      break;
    case "configuration-required":
      body = (
        <div style={widgetShellStyle}>
          <p style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Configuration required</p>
          <p style={widgetMutedStyle}>
            {message ?? "Set a valid https URL in settings before this widget can run."}
          </p>
        </div>
      );
      break;
  }

  return (
    <WidgetFrame title={title} widgetId={IFRAME_WIDGET_ID} state={state} onRefresh={onRefresh}>
      {body}
    </WidgetFrame>
  );
}
