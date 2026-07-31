import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import { widgetMutedStyle, widgetShellStyle } from "../_shared/chrome.js";
import { formatRelativeTimestamp } from "../rss/sanitize.js";
import type { YoutubeData, YoutubeItem, YoutubeLayout } from "./config.js";

const pulse: CSSProperties = {
  borderRadius: "0.25rem",
  background: "var(--ds-surface-3, #e3e8ed)",
};

export function YoutubeSkeleton({ layout = "rich" }: { layout?: YoutubeLayout }) {
  const rows = layout === "compact" ? 4 : 5;
  return (
    <div style={widgetShellStyle} aria-busy="true" aria-live="polite" aria-label="Loading YouTube">
      {layout === "rich" ? (
        <div
          style={{
            display: "grid",
            gridAutoFlow: "column",
            gridAutoColumns: "minmax(10rem, 14rem)",
            gap: "0.65rem",
            overflowX: "auto",
          }}
        >
          {["c1", "c2", "c3", "c4"].map((id) => (
            <div key={id} style={{ ...pulse, height: "8rem" }} />
          ))}
        </div>
      ) : (
        ["r1", "r2", "r3", "r4"].slice(0, rows).map((id, index) => (
          <div key={id} style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <div style={{ ...pulse, height: "0.9rem", width: index % 2 === 0 ? "78%" : "62%" }} />
          </div>
        ))
      )}
    </div>
  );
}

function linkProps(href: string, openInNewTab: boolean) {
  return {
    href,
    ...(openInNewTab ? { target: "_blank" as const, rel: "noopener noreferrer" } : {}),
  };
}

function RelativeTime({ iso }: { iso: string | null }) {
  const [label, setLabel] = useState(() => formatRelativeTimestamp(iso));

  useEffect(() => {
    setLabel(formatRelativeTimestamp(iso));
    if (!iso) {
      return;
    }
    const id = window.setInterval(() => {
      setLabel(formatRelativeTimestamp(iso));
    }, 60_000);
    return () => window.clearInterval(id);
  }, [iso]);

  if (!iso || !label) {
    return null;
  }
  return <time dateTime={iso}>{label}</time>;
}

function VideoMeta({ item }: { item: YoutubeItem }) {
  return (
    <p style={{ ...widgetMutedStyle, fontSize: "0.75rem", margin: 0 }}>
      <span>{item.channelTitle}</span>
      {item.publishedAt ? (
        <>
          <span aria-hidden="true"> · </span>
          <RelativeTime iso={item.publishedAt} />
        </>
      ) : null}
    </p>
  );
}

function CompactList({ data }: { data: YoutubeData }) {
  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: "0.55rem",
      }}
    >
      {data.items.map((item) => (
        <li key={item.id}>
          <a
            {...linkProps(item.url, data.openInNewTab)}
            style={{
              color: "inherit",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "0.9375rem",
            }}
          >
            {item.title}
          </a>
          <VideoMeta item={item} />
        </li>
      ))}
    </ul>
  );
}

function RichCardsList({ data }: { data: YoutubeData }) {
  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "grid",
        gridAutoFlow: "column",
        gridAutoColumns: "minmax(11rem, 15rem)",
        gap: "0.75rem",
        overflowX: "auto",
      }}
    >
      {data.items.map((item) => {
        const inner: ReactNode = (
          <>
            {data.showThumbnails ? (
              <div
                style={{
                  height: "6rem",
                  borderRadius: "var(--ds-radius-md, 0.5rem)",
                  background: "var(--ds-surface-3, #e3e8ed)",
                  overflow: "hidden",
                  marginBottom: "0.5rem",
                }}
              >
                {item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : null}
              </div>
            ) : null}
            <p style={{ margin: 0, fontWeight: 600, fontSize: "0.9375rem" }}>{item.title}</p>
            <div style={{ marginTop: "0.45rem" }}>
              <VideoMeta item={item} />
            </div>
          </>
        );

        return (
          <li
            key={item.id}
            style={{
              padding: "0.75rem",
              borderRadius: "var(--ds-radius-md, 0.5rem)",
              background: "var(--ds-surface-2, #f3f6f8)",
              border: "1px solid var(--ds-border, rgba(18, 23, 28, 0.1))",
            }}
          >
            <a
              {...linkProps(item.url, data.openInNewTab)}
              style={{ color: "inherit", textDecoration: "none", display: "block" }}
            >
              {inner}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

export function YoutubeBody({ data }: { data: YoutubeData }) {
  let list: ReactNode;
  switch (data.layout) {
    case "compact":
      list = <CompactList data={data} />;
      break;
    default:
      list = <RichCardsList data={data} />;
  }

  return (
    <div style={widgetShellStyle}>
      {data.failedSourceCount > 0 ? (
        <p style={{ ...widgetMutedStyle, margin: 0 }}>
          {data.failedSourceCount} channel{data.failedSourceCount === 1 ? "" : "s"} could not be
          loaded.
        </p>
      ) : null}
      {list}
    </div>
  );
}
