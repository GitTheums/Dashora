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
  type GithubReleasesConfig,
  githubReleaseRepoConfigSchema,
  githubReleasesConfigSchema,
  newGithubRepoEntryId,
} from "./config.js";

export type GithubReleasesSettingsProps = WidgetSettingsProps<GithubReleasesConfig> & {
  integrationsClient?: GithubIntegrationsClient;
};

export function GithubReleasesSettings({
  config,
  onChange,
  onSubmit,
  disabled = false,
  integrationsClient = defaultGithubIntegrationsClient,
}: GithubReleasesSettingsProps) {
  const ownerId = useId();
  const repoId = useId();
  const tokenId = useId();
  const [ownerDraft, setOwnerDraft] = useState("");
  const [repoDraft, setRepoDraft] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
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
    onSubmit?.(githubReleasesConfigSchema.parse(config));
  };

  const addRepository = () => {
    const parsed = githubReleaseRepoConfigSchema.safeParse({
      id: newGithubRepoEntryId(),
      owner: ownerDraft.trim(),
      repo: repoDraft.trim(),
    });
    if (!parsed.success) {
      setAddError(parsed.error.issues[0]?.message ?? "Enter a valid owner and repository.");
      return;
    }
    if (config.repositories.length >= 10) {
      setAddError("You can add at most 10 repositories.");
      return;
    }
    const duplicate = config.repositories.some(
      (item) =>
        item.owner.toLowerCase() === parsed.data.owner.toLowerCase() &&
        item.repo.toLowerCase() === parsed.data.repo.toLowerCase(),
    );
    if (duplicate) {
      setAddError("That repository is already in the list.");
      return;
    }
    onChange({ ...config, repositories: [...config.repositories, parsed.data] });
    setOwnerDraft("");
    setRepoDraft("");
    setAddError(null);
  };

  const removeRepository = (id: string) => {
    onChange({
      ...config,
      repositories: config.repositories.filter((item) => item.id !== id),
    });
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

  return (
    <form
      onSubmit={handleSubmit}
      aria-label="GitHub Releases settings"
      style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      <div style={widgetFieldStyle}>
        <label style={widgetLabelStyle} htmlFor={ownerId}>
          Add repository
        </label>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <input
            id={ownerId}
            style={{ ...widgetInputStyle, flex: "1 1 8rem" }}
            value={ownerDraft}
            disabled={disabled}
            placeholder="Owner"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setOwnerDraft(event.target.value)}
          />
          <input
            id={repoId}
            style={{ ...widgetInputStyle, flex: "1 1 8rem" }}
            value={repoDraft}
            disabled={disabled}
            placeholder="Repository"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setRepoDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addRepository();
              }
            }}
          />
          <button type="button" disabled={disabled} onClick={addRepository}>
            Add
          </button>
        </div>
        {addError ? (
          <p role="alert" style={{ ...widgetMutedStyle, color: "var(--ds-danger, #c43c3c)" }}>
            {addError}
          </p>
        ) : (
          <p style={widgetMutedStyle}>Up to 10 repositories. Public repos work without a token.</p>
        )}
      </div>

      {config.repositories.length > 0 ? (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem",
          }}
        >
          {config.repositories.map((repo) => (
            <li
              key={repo.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.75rem",
              }}
            >
              <span style={{ fontFamily: "var(--ds-font-mono, ui-monospace, monospace)" }}>
                {repo.owner}/{repo.repo}
              </span>
              <button type="button" disabled={disabled} onClick={() => removeRepository(repo.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input
          id="github-releases-prerelease"
          type="checkbox"
          checked={config.includePrereleases}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, includePrereleases: event.target.checked })}
        />
        <label style={widgetLabelStyle} htmlFor="github-releases-prerelease">
          Include prereleases
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input
          id="github-releases-compact"
          type="checkbox"
          checked={config.compactMode}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, compactMode: event.target.checked })}
        />
        <label style={widgetLabelStyle} htmlFor="github-releases-compact">
          Compact mode
        </label>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input
          id="github-releases-new-tab"
          type="checkbox"
          checked={config.openInNewTab}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, openInNewTab: event.target.checked })}
        />
        <label style={widgetLabelStyle} htmlFor="github-releases-new-tab">
          Open release links in a new tab
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
          Stored server-side only. Improves rate limits and unlocks private repositories.
        </p>
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
            <button
              type="button"
              disabled={disabled || tokenBusy}
              onClick={() => onChange({ ...config, credentialId: null })}
            >
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
          id="github-releases-enabled"
          type="checkbox"
          checked={config.enabled}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, enabled: event.target.checked })}
        />
        <label style={widgetLabelStyle} htmlFor="github-releases-enabled">
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
