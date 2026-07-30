import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { widgetMutedStyle, widgetShellStyle } from "../_shared/chrome.js";
import { formatRelativeTimestamp } from "../_shared/github-format.js";
import type { GithubReleaseItem, GithubReleasesData } from "./config.js";

const pulse: CSSProperties = {
  borderRadius: "0.25rem",
  background: "var(--ds-surface-3, #e3e8ed)",
};

export function GithubReleasesSkeleton({ compact = false }: { compact?: boolean }) {
  const rows = compact ? 3 : 4;
  return (
    <div style={widgetShellStyle} aria-busy="true" aria-live="polite" aria-label="Loading releases">
      {["r1", "r2", "r3", "r4"].slice(0, rows).map((id, index) => (
        <div key={id} style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <div style={{ ...pulse, height: "0.9rem", width: index % 2 === 0 ? "70%" : "55%" }} />
          {!compact ? <div style={{ ...pulse, height: "0.7rem", width: "40%" }} /> : null}
        </div>
      ))}
    </div>
  );
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

function ReleaseRow({
  item,
  openInNewTab,
  compact,
}: {
  item: GithubReleaseItem;
  openInNewTab: boolean;
  compact: boolean;
}) {
  const linkProps = {
    href: item.htmlUrl,
    ...(openInNewTab ? { target: "_blank" as const, rel: "noopener noreferrer" } : {}),
  };

  return (
    <li
      style={{
        display: "flex",
        flexDirection: "column",
        gap: compact ? "0.15rem" : "0.3rem",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.35rem 0.65rem",
          alignItems: "baseline",
        }}
      >
        <a
          {...linkProps}
          style={{
            color: "inherit",
            textDecoration: "none",
            fontWeight: 650,
            fontSize: compact ? "0.9rem" : "0.95rem",
          }}
        >
          {item.name}
        </a>
        <span
          style={{
            ...widgetMutedStyle,
            fontSize: "0.75rem",
            fontFamily: "var(--ds-font-mono, ui-monospace, monospace)",
          }}
        >
          {item.tagName}
        </span>
        {item.prerelease ? (
          <span
            style={{
              fontSize: "0.6875rem",
              fontWeight: 600,
              color: "var(--ds-warning, #b86a14)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Pre
          </span>
        ) : null}
      </div>
      <p style={{ ...widgetMutedStyle, fontSize: "0.75rem", margin: 0 }}>
        <span>{item.fullName}</span>
        {item.publishedAt ? (
          <>
            <span aria-hidden="true"> · </span>
            <RelativeTime iso={item.publishedAt} />
          </>
        ) : null}
      </p>
    </li>
  );
}

export function GithubReleasesBody({ data }: { data: GithubReleasesData }) {
  const compact = data.compactMode || data.layout === "compact";
  return (
    <div style={widgetShellStyle}>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: compact ? "0.55rem" : "0.75rem",
        }}
      >
        {data.releases.map((item) => (
          <ReleaseRow
            key={item.id}
            item={item}
            openInNewTab={data.openInNewTab}
            compact={compact}
          />
        ))}
      </ul>
      {data.failedRepoCount > 0 ? (
        <p style={{ ...widgetMutedStyle, fontSize: "0.75rem" }}>
          {data.failedRepoCount} repositor{data.failedRepoCount === 1 ? "y" : "ies"} failed to load.
        </p>
      ) : null}
    </div>
  );
}
