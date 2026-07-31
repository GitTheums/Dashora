import { type FormEvent, useState } from "react";
import type { WidgetSettingsProps } from "../../registry/types.js";
import {
  widgetFieldStyle,
  widgetInputStyle,
  widgetLabelStyle,
  widgetMutedStyle,
} from "../_shared/chrome.js";
import {
  REDDIT_SORT_LABELS,
  REDDIT_TIME_FRAME_LABELS,
  type RedditConfig,
  type RedditLayout,
  type RedditSort,
  type RedditSubredditConfig,
  type RedditTimeFrame,
  newRedditSubredditId,
  redditConfigSchema,
  redditSubredditConfigSchema,
} from "./config.js";

export type RedditSettingsProps = WidgetSettingsProps<RedditConfig>;

const SORTS = Object.keys(REDDIT_SORT_LABELS) as RedditSort[];
const TIME_FRAMES = Object.keys(REDDIT_TIME_FRAME_LABELS) as RedditTimeFrame[];

export function RedditSettings({
  config,
  onChange,
  onSubmit,
  disabled = false,
}: RedditSettingsProps) {
  const [nameDraft, setNameDraft] = useState("");
  const [sortDraft, setSortDraft] = useState<RedditSort>("hot");
  const [timeFrameDraft, setTimeFrameDraft] = useState<RedditTimeFrame>("day");
  const [labelDraft, setLabelDraft] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.(redditConfigSchema.parse(config));
  };

  const addSubreddit = () => {
    const parsed = redditSubredditConfigSchema.safeParse({
      id: newRedditSubredditId(),
      name: nameDraft.trim(),
      sort: sortDraft,
      ...(sortDraft === "top" ? { timeFrame: timeFrameDraft } : {}),
      label: labelDraft.trim(),
    });
    if (!parsed.success) {
      setAddError(parsed.error.issues[0]?.message ?? "Enter a valid subreddit name.");
      return;
    }
    if (config.subreddits.length >= 10) {
      setAddError("You can add at most 10 subreddits.");
      return;
    }
    if (
      config.subreddits.some((item) => item.name.toLowerCase() === parsed.data.name.toLowerCase())
    ) {
      setAddError("That subreddit is already configured.");
      return;
    }
    onChange({ ...config, subreddits: [...config.subreddits, parsed.data] });
    setNameDraft("");
    setLabelDraft("");
    setAddError(null);
  };

  const updateSubreddit = (id: string, patch: Partial<RedditSubredditConfig>) => {
    onChange({
      ...config,
      subreddits: config.subreddits.map((item) =>
        item.id === id ? redditSubredditConfigSchema.parse({ ...item, ...patch }) : item,
      ),
    });
  };

  const removeSubreddit = (id: string) => {
    onChange({ ...config, subreddits: config.subreddits.filter((item) => item.id !== id) });
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Reddit settings"
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      <fieldset
        style={{
          border: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
        }}
        disabled={disabled}
      >
        <legend style={{ fontWeight: 600, marginBottom: "0.35rem" }}>Subreddits</legend>
        {config.subreddits.map((subreddit) => (
          <div
            key={subreddit.id}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              padding: "0.75rem",
              borderRadius: "var(--ds-radius-md, 0.5rem)",
              border: "1px solid var(--ds-border, rgba(18, 23, 28, 0.1))",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
              <strong>r/{subreddit.name}</strong>
              <button type="button" onClick={() => removeSubreddit(subreddit.id)}>
                Remove
              </button>
            </div>
            <div style={widgetFieldStyle}>
              <label style={widgetLabelStyle} htmlFor={`reddit-sort-${subreddit.id}`}>
                Sort
              </label>
              <select
                id={`reddit-sort-${subreddit.id}`}
                style={widgetInputStyle}
                value={subreddit.sort}
                onChange={(event) =>
                  updateSubreddit(subreddit.id, { sort: event.target.value as RedditSort })
                }
              >
                {SORTS.map((sort) => (
                  <option key={sort} value={sort}>
                    {REDDIT_SORT_LABELS[sort]}
                  </option>
                ))}
              </select>
            </div>
            {subreddit.sort === "top" ? (
              <div style={widgetFieldStyle}>
                <label style={widgetLabelStyle} htmlFor={`reddit-time-${subreddit.id}`}>
                  Top posts from
                </label>
                <select
                  id={`reddit-time-${subreddit.id}`}
                  style={widgetInputStyle}
                  value={subreddit.timeFrame ?? "day"}
                  onChange={(event) =>
                    updateSubreddit(subreddit.id, {
                      timeFrame: event.target.value as RedditTimeFrame,
                    })
                  }
                >
                  {TIME_FRAMES.map((frame) => (
                    <option key={frame} value={frame}>
                      {REDDIT_TIME_FRAME_LABELS[frame]}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div style={widgetFieldStyle}>
              <label style={widgetLabelStyle} htmlFor={`reddit-label-${subreddit.id}`}>
                Label (optional)
              </label>
              <input
                id={`reddit-label-${subreddit.id}`}
                style={widgetInputStyle}
                value={subreddit.label ?? ""}
                onChange={(event) => updateSubreddit(subreddit.id, { label: event.target.value })}
              />
            </div>
            <div style={widgetFieldStyle}>
              <label style={widgetLabelStyle} htmlFor={`reddit-limit-${subreddit.id}`}>
                Item limit
              </label>
              <input
                id={`reddit-limit-${subreddit.id}`}
                style={widgetInputStyle}
                type="number"
                min={1}
                max={50}
                value={subreddit.itemLimit ?? config.defaultItemLimit}
                onChange={(event) =>
                  updateSubreddit(subreddit.id, {
                    itemLimit: Number.parseInt(event.target.value, 10) || 1,
                  })
                }
              />
            </div>
          </div>
        ))}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <div style={widgetFieldStyle}>
            <label style={widgetLabelStyle} htmlFor="reddit-add-name">
              Subreddit name
            </label>
            <input
              id="reddit-add-name"
              style={widgetInputStyle}
              placeholder="programming"
              value={nameDraft}
              onChange={(event) => setNameDraft(event.target.value)}
            />
          </div>
          <div style={widgetFieldStyle}>
            <label style={widgetLabelStyle} htmlFor="reddit-add-sort">
              Sort
            </label>
            <select
              id="reddit-add-sort"
              style={widgetInputStyle}
              value={sortDraft}
              onChange={(event) => setSortDraft(event.target.value as RedditSort)}
            >
              {SORTS.map((sort) => (
                <option key={sort} value={sort}>
                  {REDDIT_SORT_LABELS[sort]}
                </option>
              ))}
            </select>
          </div>
          {sortDraft === "top" ? (
            <div style={widgetFieldStyle}>
              <label style={widgetLabelStyle} htmlFor="reddit-add-time">
                Top posts from
              </label>
              <select
                id="reddit-add-time"
                style={widgetInputStyle}
                value={timeFrameDraft}
                onChange={(event) => setTimeFrameDraft(event.target.value as RedditTimeFrame)}
              >
                {TIME_FRAMES.map((frame) => (
                  <option key={frame} value={frame}>
                    {REDDIT_TIME_FRAME_LABELS[frame]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div style={widgetFieldStyle}>
            <label style={widgetLabelStyle} htmlFor="reddit-add-label">
              Label (optional)
            </label>
            <input
              id="reddit-add-label"
              style={widgetInputStyle}
              value={labelDraft}
              onChange={(event) => setLabelDraft(event.target.value)}
            />
          </div>
          {addError ? (
            <p style={{ ...widgetMutedStyle, color: "var(--ds-danger, #c43c3c)" }}>{addError}</p>
          ) : null}
          <button type="button" onClick={addSubreddit}>
            Add subreddit
          </button>
        </div>
      </fieldset>

      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="reddit-max-items">
          Max items (global)
        </label>
        <input
          id="reddit-max-items"
          style={widgetInputStyle}
          type="number"
          min={1}
          max={100}
          disabled={disabled}
          value={config.maxItems}
          onChange={(event) =>
            onChange({ ...config, maxItems: Number.parseInt(event.target.value, 10) || 1 })
          }
        />
      </div>

      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="reddit-default-limit">
          Default per-subreddit limit
        </label>
        <input
          id="reddit-default-limit"
          style={widgetInputStyle}
          type="number"
          min={1}
          max={50}
          disabled={disabled}
          value={config.defaultItemLimit}
          onChange={(event) =>
            onChange({
              ...config,
              defaultItemLimit: Number.parseInt(event.target.value, 10) || 1,
            })
          }
        />
      </div>

      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="reddit-layout">
          Layout
        </label>
        <select
          id="reddit-layout"
          style={widgetInputStyle}
          disabled={disabled}
          value={config.layout}
          onChange={(event) => onChange({ ...config, layout: event.target.value as RedditLayout })}
        >
          <option value="compact">Compact</option>
          <option value="rich">Rich</option>
        </select>
      </div>

      <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input
          type="checkbox"
          checked={config.showThumbnails}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, showThumbnails: event.target.checked })}
        />
        Show thumbnails
      </label>

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
        Uses the official Reddit OAuth API. Set <code>REDDIT_CLIENT_ID</code> and{" "}
        <code>REDDIT_CLIENT_SECRET</code> on the server. Credentials never leave the server.
      </p>

      {onSubmit ? (
        <button type="submit" disabled={disabled}>
          Save
        </button>
      ) : null}
    </form>
  );
}
