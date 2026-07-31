import type { CSSProperties } from "react";
import { widgetBannerStyle, widgetMutedStyle, widgetShellStyle } from "../_shared/chrome.js";
import type { IframeData } from "./config.js";

const frameWrapStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  overflow: "hidden",
  borderRadius: "var(--ds-radius-md, 0.5rem)",
  border: "1px solid var(--ds-border-strong, rgba(18, 23, 28, 0.18))",
  background: "var(--ds-surface-1, #fbfcfd)",
};

const frameStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  border: 0,
};

export function IframeBody({ data }: { data: IframeData }) {
  const paddingTop = `${(1 / data.aspectRatio) * 100}%`;
  const warning = data.embedProbe?.warning;

  return (
    <div style={widgetShellStyle}>
      {warning ? <output style={widgetBannerStyle}>{warning}</output> : null}
      <div style={{ ...frameWrapStyle, paddingTop }}>
        <iframe
          title={data.frameTitle}
          src={data.url}
          sandbox={data.sandbox}
          referrerPolicy="no-referrer"
          loading="lazy"
          style={frameStyle}
        />
      </div>
      <p style={widgetMutedStyle}>Sandboxed embed · {data.url}</p>
    </div>
  );
}

export function IframeSkeleton({ aspectRatio = 16 / 9 }: { aspectRatio?: number }) {
  return (
    <div style={widgetShellStyle} aria-busy="true" aria-live="polite" aria-label="Loading…">
      <div
        style={{
          ...frameWrapStyle,
          paddingTop: `${(1 / aspectRatio) * 100}%`,
          background: "var(--ds-surface-3, #e3e8ed)",
        }}
      />
    </div>
  );
}
