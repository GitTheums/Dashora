import type { ApiSecretIntegrationPublic } from "@dashora/shared";
import { type FormEvent, useEffect, useId, useState } from "react";
import type { WidgetSettingsProps } from "../../registry/types.js";
import {
  type ApiSecretIntegrationsClient,
  defaultApiSecretIntegrationsClient,
} from "../_shared/api-secret-integrations-client.js";
import {
  widgetFieldStyle,
  widgetInputStyle,
  widgetLabelStyle,
  widgetMutedStyle,
} from "../_shared/chrome.js";
import { type CustomApiClient, defaultCustomApiClient } from "./client.js";
import {
  CUSTOM_API_TEMPLATE_LABELS,
  type CustomApiConfig,
  type CustomApiHeader,
  type CustomApiMethod,
  type CustomApiPreviewResponse,
  type CustomApiTemplate,
  customApiConfigSchema,
} from "./config.js";

export type CustomApiSettingsProps = WidgetSettingsProps<CustomApiConfig> & {
  integrationsClient?: ApiSecretIntegrationsClient;
  apiClient?: CustomApiClient;
};

const TEMPLATES = Object.keys(CUSTOM_API_TEMPLATE_LABELS) as CustomApiTemplate[];

function updateHeader(
  headers: CustomApiHeader[],
  index: number,
  patch: Partial<CustomApiHeader>,
): CustomApiHeader[] {
  return headers.map((header, i) => (i === index ? { ...header, ...patch } : header));
}

export function CustomApiSettings({
  config,
  onChange,
  onSubmit,
  disabled = false,
  integrationsClient = defaultApiSecretIntegrationsClient,
  apiClient = defaultCustomApiClient,
}: CustomApiSettingsProps) {
  const urlId = useId();
  const [secrets, setSecrets] = useState<ApiSecretIntegrationPublic[]>([]);
  const [secretName, setSecretName] = useState("API secret");
  const [secretDraft, setSecretDraft] = useState("");
  const [secretBusy, setSecretBusy] = useState(false);
  const [secretError, setSecretError] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [preview, setPreview] = useState<CustomApiPreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void integrationsClient
      .list()
      .then((response) => {
        if (!cancelled) {
          setSecrets(response.integrations);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSecrets([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [integrationsClient]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.(customApiConfigSchema.parse(config));
  };

  const saveSecret = async () => {
    const trimmed = secretDraft.trim();
    if (!trimmed) {
      setSecretError("Paste a secret value to store it on the server.");
      return;
    }
    setSecretBusy(true);
    setSecretError(null);
    try {
      const integration = await integrationsClient.create({
        name: secretName.trim() || "API secret",
        secret: trimmed,
      });
      setSecrets((current) => [integration, ...current]);
      setSecretDraft("");
    } catch (error) {
      setSecretError(error instanceof Error ? error.message : "Could not save the secret.");
    } finally {
      setSecretBusy(false);
    }
  };

  const runPreview = async () => {
    setPreviewBusy(true);
    setPreviewError(null);
    setPreview(null);
    try {
      const parsed = customApiConfigSchema.parse(config);
      const result = await apiClient.preview(parsed);
      setPreview(result);
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : "Preview request failed.");
    } finally {
      setPreviewBusy(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="Custom API settings"
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor={urlId}>
          Request URL
        </label>
        <input
          id={urlId}
          style={widgetInputStyle}
          value={config.url}
          disabled={disabled}
          placeholder="https://api.example.com/status"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onChange({ ...config, url: event.target.value })}
        />
      </div>

      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="custom-api-method">
          Method
        </label>
        <select
          id="custom-api-method"
          style={widgetInputStyle}
          disabled={disabled}
          value={config.method}
          onChange={(event) =>
            onChange({ ...config, method: event.target.value as CustomApiMethod })
          }
        >
          <option value="GET">GET</option>
          <option value="POST">POST</option>
        </select>
      </div>

      {config.method === "POST" ? (
        <div style={widgetFieldStyle}>
          <label style={widgetLabelStyle} htmlFor="custom-api-body">
            JSON body
          </label>
          <textarea
            id="custom-api-body"
            style={{
              ...widgetInputStyle,
              minHeight: "5rem",
              fontFamily: "var(--ds-font-mono, monospace)",
            }}
            disabled={disabled}
            value={config.body}
            spellCheck={false}
            onChange={(event) => onChange({ ...config, body: event.target.value })}
          />
        </div>
      ) : null}

      <fieldset
        style={{
          margin: 0,
          padding: "0.75rem",
          border: "1px solid var(--ds-border-strong, rgba(18, 23, 28, 0.18))",
          borderRadius: "var(--ds-radius-md, 0.5rem)",
          display: "flex",
          flexDirection: "column",
          gap: "0.65rem",
        }}
      >
        <legend style={{ ...widgetLabelStyle, padding: "0 0.25rem" }}>Headers</legend>
        <p style={widgetMutedStyle}>
          Use literal values for non-sensitive headers. Reference a server-stored API secret for
          Authorization and other credentials — secrets never return to the browser.
        </p>
        {config.headers.map((header, index) => (
          <div
            key={header.id}
            style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "1fr 1fr auto" }}
          >
            <input
              style={widgetInputStyle}
              aria-label={`Header ${index + 1} name`}
              placeholder="Authorization"
              disabled={disabled}
              value={header.name}
              onChange={(event) =>
                onChange({
                  ...config,
                  headers: updateHeader(config.headers, index, { name: event.target.value }),
                })
              }
            />
            <input
              style={widgetInputStyle}
              aria-label={`Header ${index + 1} value`}
              placeholder={header.secretId ? "(using secret)" : "Bearer …"}
              disabled={disabled || Boolean(header.secretId)}
              value={header.secretId ? "" : header.value}
              onChange={(event) =>
                onChange({
                  ...config,
                  headers: updateHeader(config.headers, index, {
                    value: event.target.value,
                    secretId: null,
                  }),
                })
              }
            />
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                onChange({
                  ...config,
                  headers: config.headers.filter((_, i) => i !== index),
                })
              }
            >
              Remove
            </button>
            <select
              style={{ ...widgetInputStyle, gridColumn: "1 / -1" }}
              aria-label={`Header ${index + 1} secret`}
              disabled={disabled}
              value={header.secretId ?? ""}
              onChange={(event) =>
                onChange({
                  ...config,
                  headers: updateHeader(config.headers, index, {
                    secretId: event.target.value || null,
                    value: event.target.value ? "" : header.value,
                  }),
                })
              }
            >
              <option value="">No secret (use literal value)</option>
              {secrets.map((secret) => (
                <option key={secret.id} value={secret.id}>
                  {secret.name}
                  {secret.secretHint ? ` (…${secret.secretHint})` : ""}
                </option>
              ))}
            </select>
          </div>
        ))}
        <button
          type="button"
          disabled={disabled || config.headers.length >= 20}
          onClick={() =>
            onChange({
              ...config,
              headers: [
                ...config.headers,
                {
                  id: crypto.randomUUID(),
                  name: "X-Api-Key",
                  value: "",
                  secretId: null,
                },
              ],
            })
          }
        >
          Add header
        </button>

        <div style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "1fr 1fr auto" }}>
          <input
            style={widgetInputStyle}
            aria-label="New secret name"
            placeholder="Secret name"
            disabled={disabled || secretBusy}
            value={secretName}
            onChange={(event) => setSecretName(event.target.value)}
          />
          <input
            style={widgetInputStyle}
            aria-label="New secret value"
            placeholder="Paste secret"
            type="password"
            autoComplete="off"
            disabled={disabled || secretBusy}
            value={secretDraft}
            onChange={(event) => setSecretDraft(event.target.value)}
          />
          <button type="button" disabled={disabled || secretBusy} onClick={() => void saveSecret()}>
            Store secret
          </button>
        </div>
        {secretError ? (
          <p style={{ ...widgetMutedStyle, color: "var(--ds-danger, #c43c3c)" }} role="alert">
            {secretError}
          </p>
        ) : null}
      </fieldset>

      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="custom-api-template">
          Presentation template
        </label>
        <select
          id="custom-api-template"
          style={widgetInputStyle}
          disabled={disabled}
          value={config.template}
          onChange={(event) =>
            onChange({ ...config, template: event.target.value as CustomApiTemplate })
          }
        >
          {TEMPLATES.map((template) => (
            <option key={template} value={template}>
              {CUSTOM_API_TEMPLATE_LABELS[template]}
            </option>
          ))}
        </select>
      </div>

      {config.template === "text" ? (
        <PathField
          id="custom-api-text-path"
          label="Text path"
          value={config.mapping.textPath ?? ""}
          disabled={disabled}
          onChange={(textPath) =>
            onChange({ ...config, mapping: { ...config.mapping, textPath: textPath || undefined } })
          }
        />
      ) : null}

      {config.template === "metric" ? (
        <>
          <PathField
            id="custom-api-metric-value"
            label="Value path"
            value={config.mapping.metricValuePath ?? ""}
            disabled={disabled}
            onChange={(metricValuePath) =>
              onChange({
                ...config,
                mapping: { ...config.mapping, metricValuePath: metricValuePath || undefined },
              })
            }
          />
          <PathField
            id="custom-api-metric-label"
            label="Label path (optional)"
            value={config.mapping.metricLabelPath ?? ""}
            disabled={disabled}
            onChange={(metricLabelPath) =>
              onChange({
                ...config,
                mapping: { ...config.mapping, metricLabelPath: metricLabelPath || undefined },
              })
            }
          />
          <PathField
            id="custom-api-metric-unit"
            label="Unit path (optional)"
            value={config.mapping.metricUnitPath ?? ""}
            disabled={disabled}
            onChange={(metricUnitPath) =>
              onChange({
                ...config,
                mapping: { ...config.mapping, metricUnitPath: metricUnitPath || undefined },
              })
            }
          />
        </>
      ) : null}

      {config.template === "list" ? (
        <>
          <PathField
            id="custom-api-list-items"
            label="Items array path"
            value={config.mapping.listItemsPath ?? ""}
            disabled={disabled}
            onChange={(listItemsPath) =>
              onChange({
                ...config,
                mapping: { ...config.mapping, listItemsPath: listItemsPath || undefined },
              })
            }
          />
          <PathField
            id="custom-api-list-title"
            label="Item title path"
            value={config.mapping.listTitlePath ?? ""}
            disabled={disabled}
            onChange={(listTitlePath) =>
              onChange({
                ...config,
                mapping: { ...config.mapping, listTitlePath: listTitlePath || undefined },
              })
            }
          />
          <PathField
            id="custom-api-list-subtitle"
            label="Item subtitle path (optional)"
            value={config.mapping.listSubtitlePath ?? ""}
            disabled={disabled}
            onChange={(listSubtitlePath) =>
              onChange({
                ...config,
                mapping: { ...config.mapping, listSubtitlePath: listSubtitlePath || undefined },
              })
            }
          />
          <PathField
            id="custom-api-list-value"
            label="Item value path (optional)"
            value={config.mapping.listValuePath ?? ""}
            disabled={disabled}
            onChange={(listValuePath) =>
              onChange({
                ...config,
                mapping: { ...config.mapping, listValuePath: listValuePath || undefined },
              })
            }
          />
        </>
      ) : null}

      {config.template === "progress" ? (
        <>
          <PathField
            id="custom-api-progress-value"
            label="Value path"
            value={config.mapping.progressValuePath ?? ""}
            disabled={disabled}
            onChange={(progressValuePath) =>
              onChange({
                ...config,
                mapping: { ...config.mapping, progressValuePath: progressValuePath || undefined },
              })
            }
          />
          <PathField
            id="custom-api-progress-max"
            label="Max path (optional, default 100)"
            value={config.mapping.progressMaxPath ?? ""}
            disabled={disabled}
            onChange={(progressMaxPath) =>
              onChange({
                ...config,
                mapping: { ...config.mapping, progressMaxPath: progressMaxPath || undefined },
              })
            }
          />
          <PathField
            id="custom-api-progress-label"
            label="Label path (optional)"
            value={config.mapping.progressLabelPath ?? ""}
            disabled={disabled}
            onChange={(progressLabelPath) =>
              onChange({
                ...config,
                mapping: { ...config.mapping, progressLabelPath: progressLabelPath || undefined },
              })
            }
          />
        </>
      ) : null}

      {config.template === "status" ? (
        <>
          <PathField
            id="custom-api-status-state"
            label="State path"
            value={config.mapping.statusStatePath ?? ""}
            disabled={disabled}
            onChange={(statusStatePath) =>
              onChange({
                ...config,
                mapping: { ...config.mapping, statusStatePath: statusStatePath || undefined },
              })
            }
          />
          <PathField
            id="custom-api-status-label"
            label="Label path"
            value={config.mapping.statusLabelPath ?? ""}
            disabled={disabled}
            onChange={(statusLabelPath) =>
              onChange({
                ...config,
                mapping: { ...config.mapping, statusLabelPath: statusLabelPath || undefined },
              })
            }
          />
          <PathField
            id="custom-api-status-detail"
            label="Detail path (optional)"
            value={config.mapping.statusDetailPath ?? ""}
            disabled={disabled}
            onChange={(statusDetailPath) =>
              onChange({
                ...config,
                mapping: { ...config.mapping, statusDetailPath: statusDetailPath || undefined },
              })
            }
          />
        </>
      ) : null}

      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="custom-api-timeout">
          Timeout (ms)
        </label>
        <input
          id="custom-api-timeout"
          style={widgetInputStyle}
          type="number"
          min={1000}
          max={30000}
          disabled={disabled}
          value={config.timeoutMs}
          onChange={(event) =>
            onChange({
              ...config,
              timeoutMs: Number.parseInt(event.target.value, 10) || 10_000,
            })
          }
        />
      </div>

      <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input
          type="checkbox"
          checked={config.allowPrivateNetwork}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, allowPrivateNetwork: event.target.checked })}
        />
        Allow private / LAN targets (SSRF bypass — trusted endpoints only)
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
        Requests run only on the server. Responses are mapped into a fixed presentation model — no
        arbitrary JavaScript, HTML, or server templates.
      </p>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button type="button" disabled={disabled || previewBusy} onClick={() => void runPreview()}>
          {previewBusy ? "Testing…" : "Test request"}
        </button>
        {onSubmit ? (
          <button type="submit" disabled={disabled}>
            Save
          </button>
        ) : null}
      </div>

      {previewError ? (
        <p style={{ ...widgetMutedStyle, color: "var(--ds-danger, #c43c3c)" }} role="alert">
          {previewError}
        </p>
      ) : null}
      {preview ? (
        <div
          style={{
            padding: "0.75rem",
            borderRadius: "var(--ds-radius-md, 0.5rem)",
            border: "1px solid var(--ds-border-strong, rgba(18, 23, 28, 0.18))",
            display: "flex",
            flexDirection: "column",
            gap: "0.35rem",
          }}
          aria-live="polite"
        >
          <p style={{ margin: 0, fontWeight: 600 }}>
            Preview: {preview.state}
            {preview.ok ? " (ok)" : ""}
          </p>
          {preview.message ? <p style={widgetMutedStyle}>{preview.message}</p> : null}
          {preview.requestSummary ? (
            <p style={widgetMutedStyle}>
              {preview.requestSummary.method} {preview.requestSummary.urlLabel}
              {preview.requestSummary.headerNames.length
                ? ` · headers: ${preview.requestSummary.headerNames.join(", ")}`
                : ""}
            </p>
          ) : null}
          {preview.data ? (
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                fontSize: "0.75rem",
                color: "var(--ds-fg-muted, #55606c)",
              }}
            >
              {JSON.stringify(preview.data.presentation, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

function PathField({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div style={widgetFieldStyle}>
      <label style={widgetLabelStyle} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        style={widgetInputStyle}
        value={value}
        disabled={disabled}
        placeholder="data.value"
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
