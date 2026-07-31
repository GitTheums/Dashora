import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import { widgetMutedStyle, widgetShellStyle } from "../_shared/chrome.js";
import { VirtualList } from "../_shared/virtual-list.js";
import { formatRelativeTimestamp } from "../rss/sanitize.js";
import type { RedditData, RedditItem, RedditLayout } from "./config.js";

const pulse: CSSProperties = {
  borderRadius: "0.25rem",
  background: "var(--ds-surface-3, #e3e8ed)",
};

export function RedditSkeleton({ layout = "rich" }: { layout?: RedditLayout }) {
  const rows = layout === "compact" ? 5 : 6;
  return (
    <div style={widgetShellStyle} aria-busy="true" aria-live="polite" aria-label="Loading Reddit">
      {Array.from({ length: rows }, (_, index) => `reddit-skel-${index}`).map((id, index) => (
        <div key={id} style={{ display: "flex", gap: "0.65rem", alignItems: "start" }}>
          {layout === "rich" ? (
            <div style={{ ...pulse, width: "4.5rem", height: "4.5rem", flexShrink: 0 }} />
          ) : null}
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

function PostMeta({ item, data }: { item: RedditItem; data: RedditData }) {
  const parts: ReactNode[] = [];
  if (data.showScore) {
    parts.push(<span key="score">{item.score} pts</span>);
  }
  parts.push(<span key="by">by {item.author}</span>);
  if (item.publishedAt) {
    parts.push(<RelativeTime key="time" iso={item.publishedAt} />);
  }
  parts.push(<span key="subreddit">r/{item.subreddit}</span>);
  if (data.showCommentCount) {
    parts.push(
      <a
        key="comments"
        {...linkProps(item.permalinkUrl, data.openInNewTab)}
        style={{ color: "inherit" }}
      >
        {item.commentCount} comment{item.commentCount === 1 ? "" : "s"}
      </a>,
    );
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

function CompactRow({ item, data }: { item: RedditItem; data: RedditData }) {
  const primaryHref = item.url ?? item.permalinkUrl;
  const title = (
    <a
      {...linkProps(primaryHref, data.openInNewTab)}
      style={{
        color: "inherit",
        textDecoration: "none",
        fontWeight: 600,
        fontSize: "0.875rem",
      }}
    >
      {item.title}
    </a>
  );

  return (
    <li style={{ display: "flex", flexDirection: "column", gap: "0.2rem", minWidth: 0 }}>
      {title}
      <p style={{ ...widgetMutedStyle, fontSize: "0.75rem", margin: 0 }}>
        <span>r/{item.subreddit}</span>
        {data.showScore ? (
          <>
            <span aria-hidden="true"> · </span>
            <span>{item.score} pts</span>
          </>
        ) : null}
      </p>
    </li>
  );
}

function RichRow({ item, data }: { item: RedditItem; data: RedditData }) {
  const primaryHref = item.url ?? item.permalinkUrl;
  const title = (
    <a
      {...linkProps(primaryHref, data.openInNewTab)}
      style={{
        color: "inherit",
        textDecoration: "none",
        fontWeight: 600,
        fontSize: "0.9375rem",
      }}
    >
      {item.title}
    </a>
  );

  return (
    <li
      style={{
        display: "grid",
        gridTemplateColumns: data.showThumbnails && item.thumbnailUrl ? "4.5rem 1fr" : "1fr",
        gap: "0.75rem",
        alignItems: "start",
      }}
    >
      {data.showThumbnails && item.thumbnailUrl ? (
        <img
          src={item.thumbnailUrl}
          alt=""
          width={72}
          height={72}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          style={{
            width: "4.5rem",
            height: "4.5rem",
            objectFit: "cover",
            borderRadius: "var(--ds-radius-md, 0.5rem)",
            background: "var(--ds-surface-3, #e3e8ed)",
          }}
        />
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: 0 }}>
        {title}
        <PostMeta item={item} data={data} />
      </div>
    </li>
  );
}

export function RedditBody({ data }: { data: RedditData }) {
  const gap = data.layout === "compact" ? "0.45rem" : "0.75rem";

  return (
    <div style={widgetShellStyle}>
      {data.failedSourceCount > 0 ? (
        <p style={{ ...widgetMutedStyle, margin: 0 }}>
          {data.failedSourceCount} subreddit{data.failedSourceCount === 1 ? "" : "s"} could not be
          loaded.
        </p>
      ) : null}
      <VirtualList
        items={data.items}
        estimateSize={data.layout === "compact" ? 52 : 96}
        getKey={(item) => item.id}
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap,
        }}
        renderItem={(item) =>
          data.layout === "compact" ? (
            <CompactRow item={item} data={data} />
          ) : (
            <RichRow item={item} data={data} />
          )
        }
      />
    </div>
  );
}
