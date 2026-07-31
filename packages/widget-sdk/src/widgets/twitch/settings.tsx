import { type FormEvent, useState } from "react";
import type { WidgetSettingsProps } from "../../registry/types.js";
import {
  widgetFieldStyle,
  widgetInputStyle,
  widgetLabelStyle,
  widgetMutedStyle,
} from "../_shared/chrome.js";
import {
  type TwitchChannelConfig,
  type TwitchConfig,
  type TwitchLayout,
  newTwitchChannelId,
  twitchChannelConfigSchema,
  twitchConfigSchema,
} from "./config.js";

export type TwitchSettingsProps = WidgetSettingsProps<TwitchConfig>;

export function TwitchSettings({
  config,
  onChange,
  onSubmit,
  disabled = false,
}: TwitchSettingsProps) {
  const [loginDraft, setLoginDraft] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.(twitchConfigSchema.parse(config));
  };

  const addChannel = () => {
    const parsed = twitchChannelConfigSchema.safeParse({
      id: newTwitchChannelId(),
      login: loginDraft.trim(),
    });
    if (!parsed.success) {
      setAddError(parsed.error.issues[0]?.message ?? "Enter a valid Twitch login.");
      return;
    }
    if (config.channels.some((channel) => channel.login === parsed.data.login)) {
      setAddError("This channel is already configured.");
      return;
    }
    if (config.channels.length >= 20) {
      setAddError("You can add at most 20 channels.");
      return;
    }
    onChange({ ...config, channels: [...config.channels, parsed.data] });
    setLoginDraft("");
    setAddError(null);
  };

  const updateChannel = (id: string, patch: Partial<TwitchChannelConfig>) => {
    onChange({
      ...config,
      channels: config.channels.map((channel) =>
        channel.id === id ? { ...channel, ...patch } : channel,
      ),
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
      aria-label="Twitch settings"
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="tw-add-login">
          Add channel login
        </label>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <input
            id="tw-add-login"
            style={{ ...widgetInputStyle, flex: "1 1 14rem" }}
            value={loginDraft}
            disabled={disabled}
            placeholder="shroud"
            onChange={(event) => setLoginDraft(event.target.value)}
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
            Use the Twitch username (login), not the display name. Max 20.
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
                <label style={widgetLabelStyle} htmlFor={`tw-login-${channel.id}`}>
                  Channel {index + 1} login
                </label>
                <input
                  id={`tw-login-${channel.id}`}
                  style={widgetInputStyle}
                  value={channel.login}
                  disabled={disabled}
                  onChange={(event) => updateChannel(channel.id, { login: event.target.value })}
                />
              </div>
              <div style={widgetFieldStyle}>
                <label style={widgetLabelStyle} htmlFor={`tw-label-${channel.id}`}>
                  Label (optional)
                </label>
                <input
                  id={`tw-label-${channel.id}`}
                  style={widgetInputStyle}
                  value={channel.label ?? ""}
                  disabled={disabled}
                  maxLength={80}
                  placeholder="Uses the display name when empty"
                  onChange={(event) => updateChannel(channel.id, { label: event.target.value })}
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
        <label style={widgetLabelStyle} htmlFor="tw-layout">
          Layout
        </label>
        <select
          id="tw-layout"
          style={widgetInputStyle}
          disabled={disabled}
          value={config.layout}
          onChange={(event) => onChange({ ...config, layout: event.target.value as TwitchLayout })}
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
        Show stream thumbnails when live
      </label>

      <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input
          type="checkbox"
          checked={config.showOfflineChannels}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, showOfflineChannels: event.target.checked })}
        />
        Show offline channels
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
        Provider credentials stay on the server. Set <code>TWITCH_CLIENT_ID</code> and{" "}
        <code>TWITCH_CLIENT_SECRET</code> for the Helix API.
      </p>

      {onSubmit ? (
        <button type="submit" disabled={disabled}>
          Save
        </button>
      ) : null}
    </form>
  );
}
