import type { ReactNode } from "react";
import type { WidgetRendererProps } from "../../registry/types.js";
import {
  WidgetFrame,
  widgetBannerStyle,
  widgetMutedStyle,
  widgetShellStyle,
} from "../_shared/chrome.js";
import { TwitchBody, TwitchSkeleton } from "./body.js";
import type { TwitchConfig, TwitchData } from "./config.js";
import { TWITCH_WIDGET_ID } from "./definition.js";

export type TwitchRendererProps = WidgetRendererProps<TwitchData, TwitchConfig>;

export function TwitchRenderer({
  title,
  config,
  state,
  data,
  message,
  onRefresh,
}: TwitchRendererProps) {
  let body: ReactNode;
  switch (state) {
    case "loading":
      body = <TwitchSkeleton layout={config.layout} />;
      break;
    case "refreshing":
      body = (
        <div style={widgetShellStyle}>
          <output style={widgetBannerStyle}>{message ?? "Refreshing…"}</output>
          {data ? <TwitchBody data={data} /> : <TwitchSkeleton layout={config.layout} />}
        </div>
      );
      break;
    case "success":
      body = data ? <TwitchBody data={data} /> : <p style={widgetMutedStyle}>No Twitch payload.</p>;
      break;
    case "empty":
      body = (
        <div style={widgetShellStyle}>
          <p style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Nothing here yet</p>
          <p style={widgetMutedStyle}>{message ?? "No channels to show."}</p>
        </div>
      );
      break;
    case "stale":
      body = (
        <div style={widgetShellStyle}>
          <output style={widgetBannerStyle}>
            {message ?? "Showing last good data while a refresh is overdue."}
          </output>
          {data ? <TwitchBody data={data} /> : null}
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
    <WidgetFrame title={title} widgetId={TWITCH_WIDGET_ID} state={state} onRefresh={onRefresh}>
      {body}
    </WidgetFrame>
  );
}
