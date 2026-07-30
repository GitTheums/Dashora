import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { widgetMutedStyle, widgetShellStyle } from "../_shared/chrome.js";
import { formatCompactCount, formatRelativeTimestamp } from "../_shared/github-format.js";
import type { GithubRepositoryData, GithubRepositoryLayout } from "./config.js";

const pulse: CSSProperties = {
  borderRadius: "0.25rem",
  background: "var(--ds-surface-3, #e3e8ed)",
};

export function GithubRepositorySkeleton({
  layout = "detailed",
}: {
  layout?: GithubRepositoryLayout;
}) {
  return (
    <div
      style={widgetShellStyle}
      aria-busy="true"
      aria-live="polite"
      aria-label="Loading repository"
    >
      <div style={{ ...pulse, height: "0.875rem", width: "55%" }} />
      <div style={{ ...pulse, height: "1.25rem", width: "80%" }} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "0.5rem",
        }}
      >
        {["a", "b", "c", "d"].map((id) => (
          <div key={id} style={{ ...pulse, height: "2.75rem" }} />
        ))}
      </div>
      {layout === "detailed" ? (
        <div style={{ ...pulse, height: "0.875rem", width: "65%" }} />
      ) : null}
    </div>
  );
}

const metaGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(5rem, 1fr))",
  gap: "0.65rem",
};

const metaLabel: CSSProperties = {
  ...widgetMutedStyle,
  fontSize: "0.75rem",
};

const metaValue: CSSProperties = {
  margin: 0,
  fontSize: "0.9375rem",
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
};

function ActivityTime({ iso }: { iso: string | null }) {
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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p style={metaLabel}>{label}</p>
      <p style={metaValue}>{formatCompactCount(value)}</p>
    </div>
  );
}

export function GithubRepositoryBody({ data }: { data: GithubRepositoryData }) {
  const title = (
    <a
      href={data.htmlUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: "inherit",
        textDecoration: "none",
        fontWeight: 650,
        fontSize: data.layout === "compact" ? "0.95rem" : "1.05rem",
      }}
    >
      {data.fullName}
    </a>
  );

  return (
    <div style={widgetShellStyle}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        {title}
        {data.showDescription && data.description ? (
          <p style={{ ...widgetMutedStyle, margin: 0 }}>{data.description}</p>
        ) : null}
      </div>

      <div style={metaGrid}>
        <Stat label="Stars" value={data.stars} />
        <Stat label="Forks" value={data.forks} />
        <Stat label="Open issues" value={data.openIssues} />
        <Stat label="Open PRs" value={data.openPullRequests} />
      </div>

      {data.layout === "detailed" ? (
        <>
          <p style={{ ...widgetMutedStyle, margin: 0 }}>{data.latestActivitySummary}</p>
          {data.showLanguages && data.primaryLanguage ? (
            <p style={{ ...widgetMutedStyle, margin: 0, fontSize: "0.8125rem" }}>
              Language:{" "}
              <strong style={{ color: "var(--ds-fg, inherit)" }}>{data.primaryLanguage}</strong>
              {data.languages.length > 1 ? (
                <span>
                  {" "}
                  ·{" "}
                  {data.languages
                    .slice(0, 3)
                    .map((lang) => `${lang.name} ${Math.round(lang.percentage)}%`)
                    .join(", ")}
                </span>
              ) : null}
            </p>
          ) : null}
          {data.pushedAt ? (
            <p style={{ ...widgetMutedStyle, margin: 0, fontSize: "0.75rem" }}>
              Pushed <ActivityTime iso={data.pushedAt} />
            </p>
          ) : null}
        </>
      ) : data.showLanguages && data.primaryLanguage ? (
        <p style={{ ...widgetMutedStyle, margin: 0, fontSize: "0.8125rem" }}>
          {data.primaryLanguage} · {data.latestActivitySummary}
        </p>
      ) : (
        <p style={{ ...widgetMutedStyle, margin: 0, fontSize: "0.8125rem" }}>
          {data.latestActivitySummary}
        </p>
      )}
    </div>
  );
}
