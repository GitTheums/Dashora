import type { FormEvent } from "react";
import type { WidgetSettingsProps } from "../../registry/types.js";
import {
  widgetFieldStyle,
  widgetInputStyle,
  widgetLabelStyle,
  widgetMutedStyle,
} from "../_shared/chrome.js";
import {
  HACKER_NEWS_FEED_LABELS,
  type HackerNewsConfig,
  type HackerNewsFeed,
  type HackerNewsLayout,
  hackerNewsConfigSchema,
} from "./config.js";

export type HackerNewsSettingsProps = WidgetSettingsProps<HackerNewsConfig>;

const FEEDS = Object.keys(HACKER_NEWS_FEED_LABELS) as HackerNewsFeed[];

export function HackerNewsSettings({
  config,
  onChange,
  onSubmit,
  disabled = false,
}: HackerNewsSettingsProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.(hackerNewsConfigSchema.parse(config));
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Hacker News settings"
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="hn-feed">
          Feed
        </label>
        <select
          id="hn-feed"
          style={widgetInputStyle}
          disabled={disabled}
          value={config.feed}
          onChange={(event) => onChange({ ...config, feed: event.target.value as HackerNewsFeed })}
        >
          {FEEDS.map((feed) => (
            <option key={feed} value={feed}>
              {HACKER_NEWS_FEED_LABELS[feed]}
            </option>
          ))}
        </select>
      </div>

      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="hn-max-items">
          Max items
        </label>
        <input
          id="hn-max-items"
          style={widgetInputStyle}
          type="number"
          min={1}
          max={50}
          disabled={disabled}
          value={config.maxItems}
          onChange={(event) =>
            onChange({ ...config, maxItems: Number.parseInt(event.target.value, 10) || 1 })
          }
        />
      </div>

      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="hn-layout">
          Layout
        </label>
        <select
          id="hn-layout"
          style={widgetInputStyle}
          disabled={disabled}
          value={config.layout}
          onChange={(event) =>
            onChange({ ...config, layout: event.target.value as HackerNewsLayout })
          }
        >
          <option value="compact">Compact</option>
          <option value="rich">Rich</option>
        </select>
      </div>

      <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input
          type="checkbox"
          checked={config.showScore}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, showScore: event.target.checked })}
        />
        Show score
      </label>

      <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input
          type="checkbox"
          checked={config.showCommentCount}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, showCommentCount: event.target.checked })}
        />
        Show comment count
      </label>

      <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input
          type="checkbox"
          checked={config.openInNewTab}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, openInNewTab: event.target.checked })}
        />
        Open links in new tab
      </label>

      <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input
          type="checkbox"
          checked={config.enabled}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, enabled: event.target.checked })}
        />
        Enabled
      </label>

      <p style={widgetMutedStyle}>
        Uses the official Hacker News Firebase API. No API key is required.
      </p>

      {onSubmit ? (
        <button type="submit" disabled={disabled}>
          Save
        </button>
      ) : null}
    </form>
  );
}
