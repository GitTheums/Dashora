import type { WidgetRendererProps } from "../../registry/types.js";
import { WidgetFrame, WidgetStateBody, widgetMutedStyle } from "../_shared/chrome.js";
import {
  BOOKMARK_COLOR_CSS,
  type BookmarkIcon,
  type BookmarksConfig,
  type BookmarksData,
} from "./config.js";
import { BOOKMARKS_WIDGET_ID } from "./definition.js";

function BookmarkIconGlyph({ name }: { name: BookmarkIcon }) {
  const paths = (() => {
    switch (name) {
      case "home":
        return <path d="M2.5 7.5 8 2.5l5.5 5V13a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5V7.5Z" />;
      case "book":
        return (
          <>
            <path d="M3 2.5h7.5A1.5 1.5 0 0 1 12 4v9.5H4.5A1.5 1.5 0 0 0 3 15" />
            <path d="M3 2.5v12" />
          </>
        );
      case "cloud":
        return (
          <path d="M5 12.5h6.5a2.5 2.5 0 0 0 .3-5 3.5 3.5 0 0 0-6.7-1.2A2.5 2.5 0 0 0 5 12.5Z" />
        );
      case "mail":
        return (
          <>
            <rect x="2.5" y="3.5" width="11" height="9" rx="1" />
            <path d="m3 4.5 5 4 5-4" />
          </>
        );
      case "code":
        return (
          <>
            <path d="m5 4-3 4 3 4" />
            <path d="m11 4 3 4-3 4" />
          </>
        );
      case "globe":
        return (
          <>
            <circle cx="8" cy="8" r="5.5" />
            <path d="M2.5 8h11M8 2.5c1.8 1.8 1.8 9.2 0 11M8 2.5c-1.8 1.8-1.8 9.2 0 11" />
          </>
        );
      case "star":
        return (
          <path d="m8 2.5 1.5 3.2 3.5.5-2.5 2.5.6 3.5L8 10.5 4.9 12.2l.6-3.5-2.5-2.5 3.5-.5L8 2.5Z" />
        );
      default:
        return (
          <>
            <path d="M4.5 8.5 9 4l2.5 2.5L7 11H4.5V8.5Z" />
            <path d="m9 4 1.5-1.5 2 2L11 6" />
          </>
        );
    }
  })();

  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden="true"
      focusable="false"
    >
      {paths}
    </svg>
  );
}

function BookmarksBody({ data }: { data: BookmarksData }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {data.groups.map((group) => (
        <section key={group.id} aria-labelledby={`bookmark-group-${group.id}`}>
          <h3
            id={`bookmark-group-${group.id}`}
            style={{
              margin: "0 0 0.5rem",
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: BOOKMARK_COLOR_CSS[group.color],
              letterSpacing: "0.02em",
              textTransform: "uppercase",
            }}
          >
            {group.name}
          </h3>
          {group.items.length === 0 ? (
            <p style={widgetMutedStyle}>No links in this group.</p>
          ) : (
            <ul
              style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.5rem" }}
            >
              {group.items.map((item) => (
                <li key={item.id}>
                  <a
                    href={item.url}
                    {...(data.openInNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    style={{
                      display: "flex",
                      gap: "0.65rem",
                      alignItems: "flex-start",
                      padding: "0.5rem 0.6rem",
                      borderRadius: "var(--ds-radius-md, 0.5rem)",
                      border: "1px solid var(--ds-border, rgba(18, 23, 28, 0.1))",
                      background: "var(--ds-surface-2, #eef2f5)",
                      color: "inherit",
                      textDecoration: "none",
                    }}
                  >
                    <span
                      style={{
                        color: BOOKMARK_COLOR_CSS[group.color],
                        marginTop: "0.1rem",
                        flexShrink: 0,
                      }}
                    >
                      <BookmarkIconGlyph name={item.icon} />
                    </span>
                    <span
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.15rem",
                        minWidth: 0,
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{item.title}</span>
                      {data.showDescriptions && item.description ? (
                        <span style={widgetMutedStyle}>{item.description}</span>
                      ) : null}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

export function BookmarksRenderer({
  title,
  state,
  data,
  message,
  onRefresh,
}: WidgetRendererProps<BookmarksData, BookmarksConfig>) {
  return (
    <WidgetFrame title={title} widgetId={BOOKMARKS_WIDGET_ID} state={state} onRefresh={onRefresh}>
      <WidgetStateBody state={state} message={message} onRefresh={onRefresh}>
        {data && data.totalItems > 0 ? <BookmarksBody data={data} /> : null}
      </WidgetStateBody>
    </WidgetFrame>
  );
}
