import type { GithubIntegrationPublic } from "@dashora/shared";
import { type FormEvent, useEffect, useId, useState } from "react";
import type { WidgetSettingsProps } from "../../registry/types.js";
import {
  widgetFieldStyle,
  widgetInputStyle,
  widgetLabelStyle,
  widgetMutedStyle,
} from "../_shared/chrome.js";
import {
  type GithubIntegrationsClient,
  defaultGithubIntegrationsClient,
} from "../_shared/github-integrations-client.js";
import {
  type GithubRepositoryConfig,
  type GithubRepositoryLayout,
  githubRepositoryConfigSchema,
} from "./config.js";

export type GithubRepositorySettingsProps = WidgetSettingsProps<GithubRepositoryConfig> & {
  integrationsClient?: GithubIntegrationsClient;
};

export function GithubRepositorySettings({
  config,
  onChange,
  onSubmit,
  disabled = false,
  integrationsClient = defaultGithubIntegrationsClient,
}: GithubRepositorySettingsProps) {
  const ownerId = useId();
  const repoId = useId();
  const tokenId = useId();
  const [integrations, setIntegrations] = useState<GithubIntegrationPublic[]>([]);
  const [tokenDraft, setTokenDraft] = useState("");
  const [tokenBusy, setTokenBusy] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenMessage, setTokenMessage] = useState<string | null>(null);

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
    onSubmit?.(githubRepositoryConfigSchema.parse(config));
  };

  const saveToken = async () => {
    const trimmed = tokenDraft.trim();
    if (!trimmed) {
      setTokenError("Paste a GitHub personal access token to store it on the server.");
      return;
    }
    setTokenBusy(true);
    setTokenError(null);
    setTokenMessage(null);
    try {
      let integration: GithubIntegrationPublic;
      if (config.credentialId) {
        integration = await integrationsClient.update(config.credentialId, { token: trimmed });
      } else if (integrations[0]) {
        integration = await integrationsClient.update(integrations[0].id, { token: trimmed });
      } else {
        integration = await integrationsClient.create({
          name: "GitHub",
          token: trimmed,
        });
      }
      setIntegrations((current) => {
        const without = current.filter((item) => item.id !== integration.id);
        return [integration, ...without];
      });
      onChange({ ...config, credentialId: integration.id });
      setTokenDraft("");
      setTokenMessage("Token saved on the server. It is never sent to the browser again.");
    } catch (error) {
      setTokenError(error instanceof Error ? error.message : "Could not save the GitHub token.");
    } finally {
      setTokenBusy(false);
    }
  };

  const clearCredential = () => {
    onChange({ ...config, credentialId: null });
    setTokenMessage("This widget will use public API access (or GITHUB_TOKEN if configured).");
  };

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="GitHub Repository settings"
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor={ownerId}>
          Owner
        </label>
        <input
          id={ownerId}
          style={widgetInputStyle}
          value={config.owner}
          disabled={disabled}
          placeholder="octocat"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onChange({ ...config, owner: event.target.value })}
        />
      </div>

      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor={repoId}>
          Repository
        </label>
        <input
          id={repoId}
          style={widgetInputStyle}
          value={config.repo}
          disabled={disabled}
          placeholder="hello-world"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onChange({ ...config, repo: event.target.value })}
        />
      </div>

      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor="github-repository-layout">
          Layout
        </label>
        <select
          id="github-repository-layout"
          style={widgetInputStyle}
          value={config.layout}
          disabled={disabled}
          onChange={(event) =>
            onChange({ ...config, layout: event.target.value as GithubRepositoryLayout })
          }
        >
          <option value="detailed">Detailed</option>
          <option value="compact">Compact</option>
        </select>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input
          id="github-repository-description"
          type="checkbox"
          checked={config.showDescription}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, showDescription: event.target.checked })}
        />
        <label style={widgetLabelStyle} htmlFor="github-repository-description">
          Show description
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input
          id="github-repository-languages"
          type="checkbox"
          checked={config.showLanguages}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, showLanguages: event.target.checked })}
        />
        <label style={widgetLabelStyle} htmlFor="github-repository-languages">
          Show language metadata
        </label>
      </div>

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
        <legend style={{ ...widgetLabelStyle, padding: "0 0.25rem" }}>Optional GitHub token</legend>
        <p style={widgetMutedStyle}>
          Public repositories work without a token. A personal access token (stored only on the
          server) improves rate limits and unlocks private repositories.
        </p>
        {config.credentialId ? (
          <p style={widgetMutedStyle}>
            Linked credential:{" "}
            {integrations.find((item) => item.id === config.credentialId)?.name ?? "GitHub"}
            {integrations.find((item) => item.id === config.credentialId)?.tokenHint
              ? ` (…${integrations.find((item) => item.id === config.credentialId)?.tokenHint})`
              : ""}
          </p>
        ) : (
          <p style={widgetMutedStyle}>No linked credential for this widget.</p>
        )}
        <label style={widgetLabelStyle} htmlFor={tokenId}>
          Personal access token
        </label>
        <input
          id={tokenId}
          style={widgetInputStyle}
          type="password"
          value={tokenDraft}
          disabled={disabled || tokenBusy}
          placeholder="ghp_…"
          autoComplete="off"
          onChange={(event) => setTokenDraft(event.target.value)}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <button type="button" disabled={disabled || tokenBusy} onClick={() => void saveToken()}>
            {tokenBusy ? "Saving…" : "Save token on server"}
          </button>
          {config.credentialId ? (
            <button type="button" disabled={disabled || tokenBusy} onClick={clearCredential}>
              Unlink credential
            </button>
          ) : null}
        </div>
        {tokenError ? (
          <p role="alert" style={{ ...widgetMutedStyle, color: "var(--ds-danger, #c43c3c)" }}>
            {tokenError}
          </p>
        ) : null}
        {tokenMessage ? <p style={widgetMutedStyle}>{tokenMessage}</p> : null}
      </fieldset>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input
          id="github-repository-enabled"
          type="checkbox"
          checked={config.enabled}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, enabled: event.target.checked })}
        />
        <label style={widgetLabelStyle} htmlFor="github-repository-enabled">
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
