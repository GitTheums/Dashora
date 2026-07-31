import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import { widgetMutedStyle, widgetShellStyle } from "../_shared/chrome.js";
import { VirtualList } from "../_shared/virtual-list.js";
import { formatRelativeTimestamp } from "../rss/sanitize.js";
import type { LobstersData, LobstersItem, LobstersLayout } from "./config.js";

const pulse: CSSProperties = {
  borderRadius: "0.25rem",
  background: "var(--ds-surface-3, #e3e8ed)",
};

export function LobstersSkeleton({ layout = "rich" }: { layout?: LobstersLayout }) {
  const rows = layout === "compact" ? 5 : 6;
  return (
    <div style={widgetShellStyle} aria-busy="true" aria-live="polite" aria-label="Loading Lobsters">
      {Array.from({ length: rows }, (_, index) => `lob-skel-${index}`).map((id, index) => (
        <div key={id} style={{ display: "flex", gap: "0.65rem", alignItems: "start" }}>
          <div style={{ ...pulse, width: "1.5rem", height: "1.1rem", flexShrink: 0 }} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <div style={{ ...pulse, height: "0.9rem", width: index % 2 === 0 ? "82%" : "68%" }} />
            {layout === "rich" ? (
              <div style={{ ...pulse, height: "0.7rem", width: "48%" }} />
            ) : null}
          </div>
        </div>
      ))}
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

function StoryMeta({ item, data }: { item: LobstersItem; data: LobstersData }) {
  const parts: ReactNode[] = [];
  if (data.showScore) {
    parts.push(<span key="score">{item.score} pts</span>);
  }
  parts.push(<span key="by">by {item.author}</span>);
  if (item.publishedAt) {
    parts.push(<RelativeTime key="time" iso={item.publishedAt} />);
  }
  if (data.showCommentCount) {
    parts.push(
      <a
        key="comments"
        {...linkProps(item.commentsUrl, data.openInNewTab)}
        style={{ color: "inherit" }}
      >
        {item.commentCount} comment{item.commentCount === 1 ? "" : "s"}
      </a>,
    );
  }
  parts.push(<span key="source">{item.sourceLabel}</span>);
  if (item.tags.length > 0) {
    parts.push(<span key="tags">{item.tags.join(", ")}</span>);
  }

  return (
    <p style={{ ...widgetMutedStyle, fontSize: "0.75rem", margin: 0 }}>
      {parts.map((part, index) => (
        <span key={index === 0 ? "first" : `sep-${index}`}>
          {index > 0 ? <span aria-hidden="true"> · </span> : null}
          {part}
        </span>
      ))}
    </p>
  );
}

function StoryRow({
  item,
  data,
  rank,
}: {
  item: LobstersItem;
  data: LobstersData;
  rank: number;
}) {
  const primaryHref = item.url ?? item.commentsUrl;
  const title = (
    <a
      {...linkProps(primaryHref, data.openInNewTab)}
      style={{
        color: "inherit",
        textDecoration: "none",
        fontWeight: 600,
        fontSize: data.layout === "compact" ? "0.875rem" : "0.9375rem",
      }}
    >
      {item.title}
    </a>
  );

  return (
    <li style={{ display: "flex", gap: "0.65rem", alignItems: "start" }}>
      <span
        style={{
          ...widgetMutedStyle,
          fontVariantNumeric: "tabular-nums",
          minWidth: "1.5rem",
          textAlign: "right",
          fontSize: "0.875rem",
          paddingTop: "0.1rem",
        }}
        aria-hidden="true"
      >
        {rank}
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", minWidth: 0 }}>
        {title}
        {data.layout === "rich" ? <StoryMeta item={item} data={data} /> : null}
      </div>
    </li>
  );
}

export function LobstersBody({ data }: { data: LobstersData }) {
  return (
    <VirtualList
      items={data.items}
      estimateSize={data.layout === "compact" ? 48 : 72}
      getKey={(item) => `${item.sourceId}:${item.id}`}
      style={{
        ...widgetShellStyle,
        listStyle: "none",
        margin: 0,
        padding: 0,
        gap: data.layout === "compact" ? "0.45rem" : "0.75rem",
      }}
      renderItem={(item, index) => <StoryRow item={item} data={data} rank={index + 1} />}
    />
  );
}
