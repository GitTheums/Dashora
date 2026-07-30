import { useEffect, useState } from "react";
import type { WidgetRendererProps } from "../../registry/types.js";
import { WidgetFrame, WidgetStateBody, widgetMutedStyle } from "../_shared/chrome.js";
import { type ClockConfig, type ClockData, buildClockData } from "./config.js";
import { CLOCK_WIDGET_ID } from "./definition.js";

function ClockFaces({ config }: { config: ClockConfig }) {
  const [data, setData] = useState<ClockData>(() => buildClockData(config));

  useEffect(() => {
    setData(buildClockData(config));
    const intervalMs = config.showSeconds ? 1000 : 15_000;
    const id = window.setInterval(() => {
      setData(buildClockData(config));
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [config]);

  return (
    <div
      style={{
        display: "grid",
        gap: "0.75rem",
        gridTemplateColumns: data.secondary ? "repeat(auto-fit, minmax(8rem, 1fr))" : "1fr",
      }}
    >
      {[data.primary, data.secondary].filter(Boolean).map((face) => {
        if (!face) {
          return null;
        }
        return (
          <div
            key={face.timezone}
            style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "1.75rem",
                fontWeight: 600,
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1.15,
              }}
              aria-live="off"
            >
              <time dateTime={data.generatedAt}>{face.time}</time>
            </p>
            {face.date ? (
              <p style={{ ...widgetMutedStyle, fontSize: "0.875rem" }}>
                <time dateTime={data.generatedAt}>{face.date}</time>
              </p>
            ) : null}
            <p style={{ ...widgetMutedStyle, fontSize: "0.75rem" }}>{face.label}</p>
          </div>
        );
      })}
    </div>
  );
}

export function ClockRenderer({
  title,
  config,
  state,
  message,
  onRefresh,
}: WidgetRendererProps<ClockData, ClockConfig>) {
  return (
    <WidgetFrame title={title} widgetId={CLOCK_WIDGET_ID} state={state} onRefresh={onRefresh}>
      <WidgetStateBody state={state} message={message} onRefresh={onRefresh}>
        {state === "success" || state === "stale" || state === "refreshing" ? (
          <ClockFaces config={config} />
        ) : null}
      </WidgetStateBody>
    </WidgetFrame>
  );
}
