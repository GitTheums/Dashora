import type { ReactNode } from "react";
import type { WidgetRendererProps } from "../../registry/types.js";
import {
  WidgetFrame,
  widgetBannerStyle,
  widgetMutedStyle,
  widgetShellStyle,
} from "../_shared/chrome.js";
import { MarketsBody, MarketsSkeleton } from "./body.js";
import type { MarketsClient } from "./client.js";
import type { MarketsConfig, MarketsData } from "./config.js";
import { MARKETS_WIDGET_ID } from "./definition.js";

export type MarketsRendererProps = WidgetRendererProps<MarketsData, MarketsConfig> & {
  client?: MarketsClient;
};

export function MarketsRenderer({
  instanceId,
  title,
  config,
  state,
  data,
  message,
  onRefresh,
  client,
}: MarketsRendererProps) {
  let body: ReactNode;
  switch (state) {
    case "loading":
      body = <MarketsSkeleton layout={config.layout} />;
      break;
    case "refreshing":
      body = (
        <div style={widgetShellStyle}>
          <output style={widgetBannerStyle}>{message ?? "Refreshing…"}</output>
          {data ? (
            <MarketsBody
              data={data}
              config={config}
              instanceId={instanceId}
              {...(client ? { client } : {})}
            />
          ) : (
            <MarketsSkeleton layout={config.layout} />
          )}
        </div>
      );
      break;
    case "success":
      body = data ? (
        <MarketsBody
          data={data}
          config={config}
          instanceId={instanceId}
          {...(client ? { client } : {})}
        />
      ) : (
        <p style={widgetMutedStyle}>No market payload.</p>
      );
      break;
    case "empty":
      body = (
        <div style={widgetShellStyle}>
          <p style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>Nothing here yet</p>
          <p style={widgetMutedStyle}>{message ?? "No market quotes are available."}</p>
        </div>
      );
      break;
    case "stale":
      body = (
        <div style={widgetShellStyle}>
          <output style={widgetBannerStyle}>
            {message ?? "Showing last good data while a refresh is overdue."}
          </output>
          {data ? (
            <MarketsBody
              data={data}
              config={config}
              instanceId={instanceId}
              {...(client ? { client } : {})}
            />
          ) : null}
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
          {data ? (
            <MarketsBody
              data={data}
              config={config}
              instanceId={instanceId}
              {...(client ? { client } : {})}
            />
          ) : null}
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
            {message ??
              "Add symbols in settings and configure provider API keys on the server before this widget can run."}
          </p>
        </div>
      );
      break;
  }

  return (
    <WidgetFrame title={title} widgetId={MARKETS_WIDGET_ID} state={state} onRefresh={onRefresh}>
      {body}
    </WidgetFrame>
  );
}
