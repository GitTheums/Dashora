import { type FormEvent, useState } from "react";
import type { WidgetSettingsProps } from "../../registry/types.js";
import {
  widgetFieldStyle,
  widgetInputStyle,
  widgetLabelStyle,
  widgetMutedStyle,
} from "../_shared/chrome.js";
import {
  type RssConfig,
  type RssFeedConfig,
  type RssLayout,
  newRssFeedId,
  rssConfigSchema,
  rssFeedConfigSchema,
} from "./config.js";

export type RssSettingsProps = WidgetSettingsProps<RssConfig>;

export function RssSettings({ config, onChange, onSubmit, disabled = false }: RssSettingsProps) {
  const [urlDraft, setUrlDraft] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.(rssConfigSchema.parse(config));
  };

  const addFeed = () => {
    const parsed = rssFeedConfigSchema.safeParse({
      id: newRssFeedId(),
      url: urlDraft.trim(),
      titleOverride: "",
    });
    if (!parsed.success) {
      setAddError(parsed.error.issues[0]?.message ?? "Enter a valid http(s) feed URL.");
      return;
    }
    if (config.feeds.length >= 10) {
      setAddError("You can add at most 10 feeds.");
      return;
    }
    onChange({ ...config, feeds: [...config.feeds, parsed.data] });
    setUrlDraft("");
    setAddError(null);
  };

  const updateFeed = (id: string, patch: Partial<RssFeedConfig>) => {
    onChange({
      ...config,
      feeds: config.feeds.map((feed) => {
        if (feed.id !== id) {
          return feed;
        }
        const next: RssFeedConfig = { ...feed, ...patch };
        if ("itemLimit" in patch && patch.itemLimit === undefined) {
          const { itemLimit: _removed, ...rest } = next;
          return rest;
        }
        return next;
      }),
    });
  };

  const removeFeed = (id: string) => {
    onChange({
      ...config,
      feeds: config.feeds.filter((feed) => feed.id !== id),
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="RSS settings"
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="rss-add-url">
          Add feed URL
        </label>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <input
            id="rss-add-url"
            style={{ ...widgetInputStyle, flex: "1 1 14rem" }}
            value={urlDraft}
            disabled={disabled}
            placeholder="https://example.com/feed.xml"
            onChange={(event) => setUrlDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addFeed();
              }
            }}
          />
          <button type="button" disabled={disabled} onClick={addFeed}>
            Add feed
          </button>
        </div>
        {addError ? (
          <p role="alert" style={{ ...widgetMutedStyle, color: "var(--ds-danger, #c43c3c)" }}>
            {addError}
          </p>
        ) : (
          <p style={widgetMutedStyle}>RSS and Atom feeds are supported. Max 10 feeds.</p>
        )}
      </div>

      {config.feeds.length === 0 ? (
        <p style={widgetMutedStyle}>No feeds configured yet.</p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.85rem",
          }}
        >
          {config.feeds.map((feed, index) => (
            <li
              key={feed.id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                padding: "0.75rem",
                borderRadius: "var(--ds-radius-md, 0.5rem)",
                border: "1px solid var(--ds-border, rgba(18, 23, 28, 0.1))",
              }}
            >
              <div style={widgetFieldStyle}>
                <label style={widgetLabelStyle} htmlFor={`rss-feed-url-${feed.id}`}>
                  Feed {index + 1} URL
                </label>
                <input
                  id={`rss-feed-url-${feed.id}`}
                  style={widgetInputStyle}
                  value={feed.url}
                  disabled={disabled}
                  onChange={(event) => updateFeed(feed.id, { url: event.target.value })}
                />
              </div>
              <div style={widgetFieldStyle}>
                <label style={widgetLabelStyle} htmlFor={`rss-feed-title-${feed.id}`}>
                  Title override (optional)
                </label>
                <input
                  id={`rss-feed-title-${feed.id}`}
                  style={widgetInputStyle}
                  value={feed.titleOverride ?? ""}
                  disabled={disabled}
                  maxLength={80}
                  placeholder="Uses the feed title when empty"
                  onChange={(event) => updateFeed(feed.id, { titleOverride: event.target.value })}
                />
              </div>
              <div style={widgetFieldStyle}>
                <label style={widgetLabelStyle} htmlFor={`rss-feed-limit-${feed.id}`}>
                  Item limit (optional)
                </label>
                <input
                  id={`rss-feed-limit-${feed.id}`}
                  style={widgetInputStyle}
                  type="number"
                  min={1}
                  max={50}
                  value={feed.itemLimit ?? ""}
                  disabled={disabled}
                  placeholder={String(config.defaultItemLimit)}
                  onChange={(event) => {
                    const raw = event.target.value.trim();
                    if (!raw) {
                      updateFeed(feed.id, { itemLimit: undefined });
                      return;
                    }
                    const value = Number.parseInt(raw, 10);
                    if (Number.isFinite(value)) {
                      updateFeed(feed.id, { itemLimit: value });
                    }
                  }}
                />
              </div>
              <button type="button" disabled={disabled} onClick={() => removeFeed(feed.id)}>
                Remove feed
              </button>
            </li>
          ))}
        </ul>
      )}

      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="rss-layout">
          Layout
        </label>
        <select
          id="rss-layout"
          style={widgetInputStyle}
          value={config.layout}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, layout: event.target.value as RssLayout })}
        >
          <option value="compact">Compact</option>
          <option value="detailed">Detailed</option>
          <option value="cards">Horizontal cards</option>
        </select>
      </div>

      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="rss-max-items">
          Max items
        </label>
        <input
          id="rss-max-items"
          style={widgetInputStyle}
          type="number"
          min={1}
          max={100}
          value={config.maxItems}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...config, maxItems: Number.parseInt(event.target.value, 10) || 1 })
          }
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input
          id="rss-thumbnails"
          type="checkbox"
          checked={config.showThumbnails}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, showThumbnails: event.target.checked })}
        />
        <label style={widgetLabelStyle} htmlFor="rss-thumbnails">
          Show thumbnails when available
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input
          id="rss-dedupe"
          type="checkbox"
          checked={config.dedupeLinks}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, dedupeLinks: event.target.checked })}
        />
        <label style={widgetLabelStyle} htmlFor="rss-dedupe">
          Deduplicate matching links
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input
          id="rss-new-tab"
          type="checkbox"
          checked={config.openInNewTab}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, openInNewTab: event.target.checked })}
        />
        <label style={widgetLabelStyle} htmlFor="rss-new-tab">
          Open links in a new tab
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input
          id="rss-enabled"
          type="checkbox"
          checked={config.enabled}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, enabled: event.target.checked })}
        />
        <label style={widgetLabelStyle} htmlFor="rss-enabled">
          Enabled
        </label>
      </div>

      {onSubmit ? (
        <button type="submit" disabled={disabled}>
          Save settings
        </button>
      ) : null}
    </form>
  );
}
