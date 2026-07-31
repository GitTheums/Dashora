import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import { widgetMutedStyle, widgetShellStyle } from "../_shared/chrome.js";
import { formatRelativeTimestamp } from "../rss/sanitize.js";
import type { TwitchData, TwitchItem, TwitchLayout } from "./config.js";

const pulse: CSSProperties = {
  borderRadius: "0.25rem",
  background: "var(--ds-surface-3, #e3e8ed)",
};

const liveBadgeStyle: CSSProperties = {
  display: "inline-block",
  padding: "0.1rem 0.4rem",
  borderRadius: "0.25rem",
  fontSize: "0.65rem",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  background: "var(--ds-danger, #c43c3c)",
  color: "var(--ds-primary-fg, #ffffff)",
};

export function TwitchSkeleton({ layout = "rich" }: { layout?: TwitchLayout }) {
  const rows = layout === "compact" ? 4 : 5;
  return (
    <div style={widgetShellStyle} aria-busy="true" aria-live="polite" aria-label="Loading Twitch">
      {Array.from({ length: rows }, (_, index) => `tw-skel-${index}`).map((id, index) => (
        <div
          key={id}
          style={{
            display: "grid",
            gridTemplateColumns: layout === "rich" ? "5rem 1fr" : "1fr",
            gap: "0.65rem",
            alignItems: "start",
          }}
        >
          {layout === "rich" ? <div style={{ ...pulse, width: "5rem", height: "2.8rem" }} /> : null}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <div style={{ ...pulse, height: "0.9rem", width: index % 2 === 0 ? "72%" : "58%" }} />
            <div style={{ ...pulse, height: "0.7rem", width: "40%" }} />
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

function ChannelMeta({ item }: { item: TwitchItem }) {
  const parts: ReactNode[] = [];
  if (item.isLive) {
    parts.push(
      <span key="live" style={liveBadgeStyle} aria-label="Live">
        Live
      </span>,
    );
    if (item.viewerCount > 0) {
      parts.push(
        <span key="viewers">
          {item.viewerCount.toLocaleString("en-US")} viewer{item.viewerCount === 1 ? "" : "s"}
        </span>,
      );
    }
    if (item.gameName) {
      parts.push(<span key="game">{item.gameName}</span>);
    }
    if (item.startedAt) {
      parts.push(<RelativeTime key="started" iso={item.startedAt} />);
    }
  } else {
    parts.push(<span key="offline">Offline</span>);
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

function ChannelRow({ item, data }: { item: TwitchItem; data: TwitchData }) {
  const title = item.isLive && item.title ? item.title : item.displayName;
  const showThumb = data.showThumbnails && item.thumbnailUrl && item.isLive;

  return (
    <li
      style={{
        display: "grid",
        gridTemplateColumns: showThumb && data.layout === "rich" ? "5rem 1fr" : "1fr",
        gap: "0.65rem",
        alignItems: "start",
      }}
    >
      {showThumb && data.layout === "rich" ? (
        <img
          src={item.thumbnailUrl ?? undefined}
          alt=""
          width={80}
          height={45}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          style={{
            width: "5rem",
            height: "2.8rem",
            objectFit: "cover",
            borderRadius: "var(--ds-radius-md, 0.5rem)",
            background: "var(--ds-surface-3, #e3e8ed)",
          }}
        />
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem", minWidth: 0 }}>
        <a
          {...linkProps(item.url, data.openInNewTab)}
          style={{
            color: "inherit",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: data.layout === "compact" ? "0.875rem" : "0.9375rem",
          }}
        >
          {title}
        </a>
        {data.layout === "rich" || item.isLive ? (
          <ChannelMeta item={item} />
        ) : (
          <p style={{ ...widgetMutedStyle, fontSize: "0.75rem", margin: 0 }}>{item.displayName}</p>
        )}
      </div>
    </li>
  );
}

export function TwitchBody({ data }: { data: TwitchData }) {
  return (
    <ul
      style={{
        ...widgetShellStyle,
        listStyle: "none",
        margin: 0,
        padding: 0,
        gap: data.layout === "compact" ? "0.55rem" : "0.75rem",
      }}
    >
      {data.items.map((item) => (
        <ChannelRow key={item.id} item={item} data={data} />
      ))}
    </ul>
  );
}
