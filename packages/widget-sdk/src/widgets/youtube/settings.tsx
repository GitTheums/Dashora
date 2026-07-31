import { type FormEvent, useState } from "react";
import type { WidgetSettingsProps } from "../../registry/types.js";
import {
  widgetFieldStyle,
  widgetInputStyle,
  widgetLabelStyle,
  widgetMutedStyle,
} from "../_shared/chrome.js";
import {
  type YoutubeChannelConfig,
  type YoutubeConfig,
  type YoutubeLayout,
  newYoutubeChannelId,
  youtubeChannelConfigSchema,
  youtubeConfigSchema,
} from "./config.js";

export type YoutubeSettingsProps = WidgetSettingsProps<YoutubeConfig>;

export function YoutubeSettings({
  config,
  onChange,
  onSubmit,
  disabled = false,
}: YoutubeSettingsProps) {
  const [channelIdDraft, setChannelIdDraft] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.(youtubeConfigSchema.parse(config));
  };

  const addChannel = () => {
    const parsed = youtubeChannelConfigSchema.safeParse({
      id: newYoutubeChannelId(),
      channelId: channelIdDraft.trim(),
    });
    if (!parsed.success) {
      setAddError(parsed.error.issues[0]?.message ?? "Enter a valid YouTube channel ID.");
      return;
    }
    if (config.channels.some((channel) => channel.channelId === parsed.data.channelId)) {
      setAddError("This channel is already configured.");
      return;
    }
    if (config.channels.length >= 10) {
      setAddError("You can add at most 10 channels.");
      return;
    }
    onChange({ ...config, channels: [...config.channels, parsed.data] });
    setChannelIdDraft("");
    setAddError(null);
  };

  const updateChannel = (id: string, patch: Partial<YoutubeChannelConfig>) => {
    onChange({
      ...config,
      channels: config.channels.map((channel) => {
        if (channel.id !== id) {
          return channel;
        }
        const next: YoutubeChannelConfig = { ...channel, ...patch };
        if ("itemLimit" in patch && patch.itemLimit === undefined) {
          const { itemLimit: _removed, ...rest } = next;
          return rest;
        }
        return next;
      }),
    });
  };

  const removeChannel = (id: string) => {
    onChange({
      ...config,
      channels: config.channels.filter((channel) => channel.id !== id),
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="YouTube settings"
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="yt-add-channel">
          Add channel ID
        </label>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <input
            id="yt-add-channel"
            style={{ ...widgetInputStyle, flex: "1 1 14rem" }}
            value={channelIdDraft}
            disabled={disabled}
            placeholder="UCxxxxxxxxxxxxxxxxxxxxxx"
            onChange={(event) => setChannelIdDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addChannel();
              }
            }}
          />
          <button type="button" disabled={disabled} onClick={addChannel}>
            Add channel
          </button>
        </div>
        {addError ? (
          <p role="alert" style={{ ...widgetMutedStyle, color: "var(--ds-danger, #c43c3c)" }}>
            {addError}
          </p>
        ) : (
          <p style={widgetMutedStyle}>
            Use the channel ID from a YouTube channel page (starts with UC). Max 10 channels. No API
            key required.
          </p>
        )}
      </div>

      {config.channels.length === 0 ? (
        <p style={widgetMutedStyle}>No channels configured yet.</p>
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
          {config.channels.map((channel, index) => (
            <li
              key={channel.id}
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
                <label style={widgetLabelStyle} htmlFor={`yt-channel-id-${channel.id}`}>
                  Channel {index + 1} ID
                </label>
                <input
                  id={`yt-channel-id-${channel.id}`}
                  style={widgetInputStyle}
                  value={channel.channelId}
                  disabled={disabled}
                  onChange={(event) => updateChannel(channel.id, { channelId: event.target.value })}
                />
              </div>
              <div style={widgetFieldStyle}>
                <label style={widgetLabelStyle} htmlFor={`yt-channel-label-${channel.id}`}>
                  Label (optional)
                </label>
                <input
                  id={`yt-channel-label-${channel.id}`}
                  style={widgetInputStyle}
                  value={channel.label ?? ""}
                  disabled={disabled}
                  maxLength={80}
                  placeholder="Uses the feed title when empty"
                  onChange={(event) => updateChannel(channel.id, { label: event.target.value })}
                />
              </div>
              <div style={widgetFieldStyle}>
                <label style={widgetLabelStyle} htmlFor={`yt-channel-limit-${channel.id}`}>
                  Item limit (optional)
                </label>
                <input
                  id={`yt-channel-limit-${channel.id}`}
                  style={widgetInputStyle}
                  type="number"
                  min={1}
                  max={50}
                  value={channel.itemLimit ?? ""}
                  disabled={disabled}
                  placeholder={String(config.defaultItemLimit)}
                  onChange={(event) => {
                    const raw = event.target.value.trim();
                    if (!raw) {
                      updateChannel(channel.id, { itemLimit: undefined });
                      return;
                    }
                    const value = Number.parseInt(raw, 10);
                    if (Number.isFinite(value)) {
                      updateChannel(channel.id, { itemLimit: value });
                    }
                  }}
                />
              </div>
              <button type="button" disabled={disabled} onClick={() => removeChannel(channel.id)}>
                Remove channel
              </button>
            </li>
          ))}
        </ul>
      )}

      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="yt-layout">
          Layout
        </label>
        <select
          id="yt-layout"
          style={widgetInputStyle}
          disabled={disabled}
          value={config.layout}
          onChange={(event) => onChange({ ...config, layout: event.target.value as YoutubeLayout })}
        >
          <option value="compact">Compact</option>
          <option value="rich">Rich (cards with thumbnails)</option>
        </select>
      </div>

      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="yt-max-items">
          Max items
        </label>
        <input
          id="yt-max-items"
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

      {onSubmit ? (
        <button type="submit" disabled={disabled}>
          Save
        </button>
      ) : null}
    </form>
  );
}
