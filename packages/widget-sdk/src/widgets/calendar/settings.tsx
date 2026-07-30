import type { IcsBasicAuthIntegrationPublic } from "@dashora/shared";
import { type FormEvent, useEffect, useState } from "react";
import type { WidgetSettingsProps } from "../../registry/types.js";
import {
  widgetFieldStyle,
  widgetInputStyle,
  widgetLabelStyle,
  widgetMutedStyle,
} from "../_shared/chrome.js";
import {
  type IcsBasicAuthIntegrationsClient,
  defaultIcsBasicAuthIntegrationsClient,
} from "../_shared/ics-basic-auth-client.js";
import {
  type CalendarColorToken,
  type CalendarConfig,
  type CalendarFeedConfig,
  type CalendarLayout,
  calendarColorTokenSchema,
  calendarConfigSchema,
  calendarFeedConfigSchema,
  newCalendarFeedId,
} from "./config.js";

export type CalendarSettingsProps = WidgetSettingsProps<CalendarConfig> & {
  integrationsClient?: IcsBasicAuthIntegrationsClient;
};

const COLOR_OPTIONS = calendarColorTokenSchema.options;

export function CalendarSettings({
  config,
  onChange,
  onSubmit,
  disabled = false,
  integrationsClient = defaultIcsBasicAuthIntegrationsClient,
}: CalendarSettingsProps) {
  const [urlDraft, setUrlDraft] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<IcsBasicAuthIntegrationPublic[]>([]);
  const [authName, setAuthName] = useState("ICS feed");
  const [authUser, setAuthUser] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void integrationsClient
      .list()
      .then((response) => {
        if (!cancelled) {
          setIntegrations(response.integrations);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIntegrations([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [integrationsClient]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.(calendarConfigSchema.parse(config));
  };

  const addFeed = () => {
    const parsed = calendarFeedConfigSchema.safeParse({
      id: newCalendarFeedId(),
      url: urlDraft.trim(),
      titleOverride: "",
      color: "primary",
      credentialId: null,
    });
    if (!parsed.success) {
      setAddError(parsed.error.issues[0]?.message ?? "Enter a valid http(s) ICS URL.");
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

  const updateFeed = (id: string, patch: Partial<CalendarFeedConfig>) => {
    onChange({
      ...config,
      feeds: config.feeds.map((feed) => (feed.id === id ? { ...feed, ...patch } : feed)),
    });
  };

  const removeFeed = (id: string) => {
    onChange({
      ...config,
      feeds: config.feeds.filter((feed) => feed.id !== id),
    });
  };

  const saveBasicAuth = async () => {
    const username = authUser.trim();
    const password = authPass;
    if (!username || !password) {
      setAuthError("Enter both username and password to store basic authentication.");
      return;
    }
    setAuthBusy(true);
    setAuthError(null);
    setAuthMessage(null);
    try {
      const integration = await integrationsClient.create({
        name: authName.trim() || "ICS feed",
        username,
        password,
      });
      setIntegrations((current) => [
        integration,
        ...current.filter((item) => item.id !== integration.id),
      ]);
      setAuthUser("");
      setAuthPass("");
      setAuthMessage("Credentials saved on the server. Assign them to a feed below.");
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Could not save basic authentication credentials.",
      );
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Calendar settings"
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="calendar-add-url">
          Add ICS feed URL
        </label>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <input
            id="calendar-add-url"
            style={{ ...widgetInputStyle, flex: "1 1 14rem" }}
            value={urlDraft}
            disabled={disabled}
            placeholder="https://example.com/calendar.ics"
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
          <p style={widgetMutedStyle}>
            Public ICS/iCal URLs only. Optional basic auth is stored server-side. Max 10 feeds. No
            Google or Microsoft OAuth in this phase.
          </p>
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
                <label style={widgetLabelStyle} htmlFor={`calendar-feed-url-${feed.id}`}>
                  Feed {index + 1} URL
                </label>
                <input
                  id={`calendar-feed-url-${feed.id}`}
                  style={widgetInputStyle}
                  value={feed.url}
                  disabled={disabled}
                  onChange={(event) => updateFeed(feed.id, { url: event.target.value })}
                />
              </div>
              <div style={widgetFieldStyle}>
                <label style={widgetLabelStyle} htmlFor={`calendar-feed-title-${feed.id}`}>
                  Title override (optional)
                </label>
                <input
                  id={`calendar-feed-title-${feed.id}`}
                  style={widgetInputStyle}
                  value={feed.titleOverride ?? ""}
                  disabled={disabled}
                  maxLength={80}
                  placeholder="Uses the calendar name when empty"
                  onChange={(event) => updateFeed(feed.id, { titleOverride: event.target.value })}
                />
              </div>
              <div style={widgetFieldStyle}>
                <label style={widgetLabelStyle} htmlFor={`calendar-feed-color-${feed.id}`}>
                  Color
                </label>
                <select
                  id={`calendar-feed-color-${feed.id}`}
                  style={widgetInputStyle}
                  value={feed.color}
                  disabled={disabled}
                  onChange={(event) =>
                    updateFeed(feed.id, { color: event.target.value as CalendarColorToken })
                  }
                >
                  {COLOR_OPTIONS.map((color) => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
                </select>
              </div>
              <div style={widgetFieldStyle}>
                <label style={widgetLabelStyle} htmlFor={`calendar-feed-auth-${feed.id}`}>
                  Basic auth credential (optional)
                </label>
                <select
                  id={`calendar-feed-auth-${feed.id}`}
                  style={widgetInputStyle}
                  value={feed.credentialId ?? ""}
                  disabled={disabled}
                  onChange={(event) => {
                    const value = event.target.value;
                    updateFeed(feed.id, { credentialId: value ? value : null });
                  }}
                >
                  <option value="">None</option>
                  {integrations.map((integration) => (
                    <option key={integration.id} value={integration.id}>
                      {integration.name}
                      {integration.usernameHint ? ` (${integration.usernameHint})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" disabled={disabled} onClick={() => removeFeed(feed.id)}>
                Remove feed
              </button>
            </li>
          ))}
        </ul>
      )}

      <fieldset
        style={{
          border: "1px solid var(--ds-border, rgba(18, 23, 28, 0.1))",
          borderRadius: "var(--ds-radius-md, 0.5rem)",
          padding: "0.75rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.65rem",
          margin: 0,
        }}
      >
        <legend style={{ ...widgetLabelStyle, padding: "0 0.35rem" }}>
          Store basic authentication
        </legend>
        <p style={widgetMutedStyle}>
          Credentials are encrypted on the server and never returned to the browser after save.
        </p>
        <div style={widgetFieldStyle}>
          <label style={widgetLabelStyle} htmlFor="calendar-auth-name">
            Label
          </label>
          <input
            id="calendar-auth-name"
            style={widgetInputStyle}
            value={authName}
            disabled={disabled || authBusy}
            onChange={(event) => setAuthName(event.target.value)}
          />
        </div>
        <div style={widgetFieldStyle}>
          <label style={widgetLabelStyle} htmlFor="calendar-auth-user">
            Username
          </label>
          <input
            id="calendar-auth-user"
            style={widgetInputStyle}
            value={authUser}
            disabled={disabled || authBusy}
            autoComplete="off"
            onChange={(event) => setAuthUser(event.target.value)}
          />
        </div>
        <div style={widgetFieldStyle}>
          <label style={widgetLabelStyle} htmlFor="calendar-auth-pass">
            Password
          </label>
          <input
            id="calendar-auth-pass"
            style={widgetInputStyle}
            type="password"
            value={authPass}
            disabled={disabled || authBusy}
            autoComplete="new-password"
            onChange={(event) => setAuthPass(event.target.value)}
          />
        </div>
        <button type="button" disabled={disabled || authBusy} onClick={() => void saveBasicAuth()}>
          {authBusy ? "Saving…" : "Save credentials"}
        </button>
        {authError ? (
          <p role="alert" style={{ ...widgetMutedStyle, color: "var(--ds-danger, #c43c3c)" }}>
            {authError}
          </p>
        ) : null}
        {authMessage ? <p style={widgetMutedStyle}>{authMessage}</p> : null}
      </fieldset>

      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="calendar-layout">
          Layout
        </label>
        <select
          id="calendar-layout"
          style={widgetInputStyle}
          value={config.layout}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...config, layout: event.target.value as CalendarLayout })
          }
        >
          <option value="day">Day</option>
          <option value="agenda">Agenda</option>
          <option value="month-summary">Month summary</option>
        </select>
      </div>

      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="calendar-timezone">
          Timezone
        </label>
        <input
          id="calendar-timezone"
          style={widgetInputStyle}
          value={config.timezone}
          disabled={disabled}
          placeholder="UTC"
          onChange={(event) => onChange({ ...config, timezone: event.target.value })}
        />
        <p style={widgetMutedStyle}>Use an IANA timezone name.</p>
      </div>

      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="calendar-lookahead">
          Look-ahead days
        </label>
        <input
          id="calendar-lookahead"
          style={widgetInputStyle}
          type="number"
          min={1}
          max={90}
          value={config.lookAheadDays}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...config,
              lookAheadDays: Number.parseInt(event.target.value, 10) || 1,
            })
          }
        />
      </div>

      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="calendar-max-events">
          Max events
        </label>
        <input
          id="calendar-max-events"
          style={widgetInputStyle}
          type="number"
          min={1}
          max={200}
          value={config.maxEvents}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...config,
              maxEvents: Number.parseInt(event.target.value, 10) || 1,
            })
          }
        />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input
          id="calendar-hide-desc"
          type="checkbox"
          checked={config.hideDescriptions}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, hideDescriptions: event.target.checked })}
        />
        <label style={widgetLabelStyle} htmlFor="calendar-hide-desc">
          Hide event descriptions
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input
          id="calendar-redact-private"
          type="checkbox"
          checked={config.redactPrivateDetails}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, redactPrivateDetails: event.target.checked })}
        />
        <label style={widgetLabelStyle} htmlFor="calendar-redact-private">
          Redact private event details
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input
          id="calendar-enabled"
          type="checkbox"
          checked={config.enabled}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, enabled: event.target.checked })}
        />
        <label style={widgetLabelStyle} htmlFor="calendar-enabled">
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
