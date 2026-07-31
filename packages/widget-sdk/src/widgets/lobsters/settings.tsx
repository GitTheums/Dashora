import { type FormEvent, useState } from "react";
import type { WidgetSettingsProps } from "../../registry/types.js";
import {
  widgetFieldStyle,
  widgetInputStyle,
  widgetLabelStyle,
  widgetMutedStyle,
} from "../_shared/chrome.js";
import {
  LOBSTERS_SOURCE_KIND_LABELS,
  type LobstersConfig,
  type LobstersLayout,
  type LobstersSourceConfig,
  type LobstersSourceKind,
  lobstersConfigSchema,
  lobstersSourceConfigSchema,
  newLobstersSourceId,
} from "./config.js";

export type LobstersSettingsProps = WidgetSettingsProps<LobstersConfig>;

const SOURCE_KINDS = Object.keys(LOBSTERS_SOURCE_KIND_LABELS) as LobstersSourceKind[];

export function LobstersSettings({
  config,
  onChange,
  onSubmit,
  disabled = false,
}: LobstersSettingsProps) {
  const [kindDraft, setKindDraft] = useState<LobstersSourceKind>("hottest");
  const [tagDraft, setTagDraft] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.(lobstersConfigSchema.parse(config));
  };

  const addSource = () => {
    const parsed = lobstersSourceConfigSchema.safeParse({
      id: newLobstersSourceId(),
      kind: kindDraft,
      ...(kindDraft === "tag" ? { tag: tagDraft.trim() } : {}),
    });
    if (!parsed.success) {
      setAddError(parsed.error.issues[0]?.message ?? "Enter a valid source configuration.");
      return;
    }
    if (config.sources.length >= 10) {
      setAddError("You can add at most 10 sources.");
      return;
    }
    onChange({ ...config, sources: [...config.sources, parsed.data] });
    setTagDraft("");
    setAddError(null);
  };

  const updateSource = (id: string, patch: Partial<LobstersSourceConfig>) => {
    onChange({
      ...config,
      sources: config.sources.map((source) => {
        if (source.id !== id) {
          return source;
        }
        const next: LobstersSourceConfig = { ...source, ...patch };
        if ("itemLimit" in patch && patch.itemLimit === undefined) {
          const { itemLimit: _removed, ...rest } = next;
          return rest;
        }
        const validated = lobstersSourceConfigSchema.safeParse(next);
        return validated.success ? validated.data : source;
      }),
    });
  };

  const removeSource = (id: string) => {
    onChange({
      ...config,
      sources: config.sources.filter((source) => source.id !== id),
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Lobsters settings"
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="lob-add-kind">
          Add source
        </label>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <select
            id="lob-add-kind"
            style={widgetInputStyle}
            disabled={disabled}
            value={kindDraft}
            onChange={(event) => setKindDraft(event.target.value as LobstersSourceKind)}
          >
            {SOURCE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {LOBSTERS_SOURCE_KIND_LABELS[kind]}
              </option>
            ))}
          </select>
          {kindDraft === "tag" ? (
            <input
              id="lob-add-tag"
              style={{ ...widgetInputStyle, flex: "1 1 10rem" }}
              disabled={disabled}
              placeholder="Tag name (e.g. rust)"
              value={tagDraft}
              onChange={(event) => setTagDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addSource();
                }
              }}
            />
          ) : null}
          <button type="button" disabled={disabled} onClick={addSource}>
            Add source
          </button>
        </div>
        {addError ? (
          <p role="alert" style={{ ...widgetMutedStyle, color: "var(--ds-danger, #c43c3c)" }}>
            {addError}
          </p>
        ) : (
          <p style={widgetMutedStyle}>
            Uses official lobste.rs JSON feeds. No API key is required. Max 10 sources.
          </p>
        )}
      </div>

      {config.sources.length === 0 ? (
        <p style={widgetMutedStyle}>No sources configured yet.</p>
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
          {config.sources.map((source, index) => (
            <li
              key={source.id}
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
                <label style={widgetLabelStyle} htmlFor={`lob-source-kind-${source.id}`}>
                  Source {index + 1} type
                </label>
                <select
                  id={`lob-source-kind-${source.id}`}
                  style={widgetInputStyle}
                  disabled={disabled}
                  value={source.kind}
                  onChange={(event) =>
                    updateSource(source.id, { kind: event.target.value as LobstersSourceKind })
                  }
                >
                  {SOURCE_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {LOBSTERS_SOURCE_KIND_LABELS[kind]}
                    </option>
                  ))}
                </select>
              </div>
              {source.kind === "tag" ? (
                <div style={widgetFieldStyle}>
                  <label style={widgetLabelStyle} htmlFor={`lob-source-tag-${source.id}`}>
                    Tag
                  </label>
                  <input
                    id={`lob-source-tag-${source.id}`}
                    style={widgetInputStyle}
                    disabled={disabled}
                    value={source.tag ?? ""}
                    onChange={(event) => updateSource(source.id, { tag: event.target.value })}
                  />
                </div>
              ) : null}
              <div style={widgetFieldStyle}>
                <label style={widgetLabelStyle} htmlFor={`lob-source-label-${source.id}`}>
                  Label override (optional)
                </label>
                <input
                  id={`lob-source-label-${source.id}`}
                  style={widgetInputStyle}
                  disabled={disabled}
                  value={source.label ?? ""}
                  onChange={(event) => updateSource(source.id, { label: event.target.value })}
                />
              </div>
              <div style={widgetFieldStyle}>
                <label style={widgetLabelStyle} htmlFor={`lob-source-limit-${source.id}`}>
                  Item limit (optional)
                </label>
                <input
                  id={`lob-source-limit-${source.id}`}
                  style={widgetInputStyle}
                  type="number"
                  min={1}
                  max={50}
                  disabled={disabled}
                  value={source.itemLimit ?? ""}
                  placeholder={`Default (${config.defaultItemLimit})`}
                  onChange={(event) => {
                    const raw = event.target.value.trim();
                    updateSource(source.id, {
                      itemLimit: raw ? Number.parseInt(raw, 10) || undefined : undefined,
                    });
                  }}
                />
              </div>
              <button type="button" disabled={disabled} onClick={() => removeSource(source.id)}>
                Remove source
              </button>
            </li>
          ))}
        </ul>
      )}

      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="lob-max-items">
          Max items (global)
        </label>
        <input
          id="lob-max-items"
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
        <label style={widgetLabelStyle} htmlFor="lob-default-limit">
          Default per-source limit
        </label>
        <input
          id="lob-default-limit"
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
        <label style={widgetLabelStyle} htmlFor="lob-layout">
          Layout
        </label>
        <select
          id="lob-layout"
          style={widgetInputStyle}
          disabled={disabled}
          value={config.layout}
          onChange={(event) =>
            onChange({ ...config, layout: event.target.value as LobstersLayout })
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

      {onSubmit ? (
        <button type="submit" disabled={disabled}>
          Save
        </button>
      ) : null}
    </form>
  );
}
