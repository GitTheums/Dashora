import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import { GITHUB_REPOSITORY_DEFAULT_CONFIG, type GithubRepositoryData } from "./config.js";
import { GithubRepositoryRenderer } from "./renderer.js";
import { GithubRepositorySettings } from "./settings.js";

const sampleData: GithubRepositoryData = {
  owner: "dashora",
  name: "dashora",
  fullName: "dashora/dashora",
  description: "Personal dashboard",
  htmlUrl: "https://github.com/dashora/dashora",
  stars: 42,
  forks: 3,
  openIssues: 5,
  openPullRequests: 2,
  primaryLanguage: "TypeScript",
  languages: [{ name: "TypeScript", bytes: 900, percentage: 90 }],
  pushedAt: "2026-07-30T10:00:00.000Z",
  updatedAt: "2026-07-30T11:00:00.000Z",
  latestActivitySummary: "Last push 2 hours ago.",
  isPrivate: false,
  layout: "detailed",
  showDescription: true,
  showLanguages: true,
  providerId: "github",
  fetchedAt: "2026-07-30T12:00:00.000Z",
  authenticated: false,
};

afterEach(() => {
  cleanup();
});

describe("GithubRepositoryRenderer", () => {
  it.each(REQUIRED_WIDGET_STATES)("renders state=%s", (state) => {
    render(
      <GithubRepositoryRenderer
        instanceId="1"
        title="GitHub Repository"
        config={{ ...GITHUB_REPOSITORY_DEFAULT_CONFIG, owner: "dashora", repo: "dashora" }}
        state={state}
        {...(state === "success" || state === "empty" || state === "stale" || state === "refreshing"
          ? { data: sampleData }
          : {})}
        message={`msg-${state}`}
      />,
    );
    expect(
      document.querySelector(`[data-widget="github-repository"][data-state="${state}"]`),
    ).toBeTruthy();
  });
});

describe("GithubRepositorySettings", () => {
  it("renders owner and repository fields", () => {
    render(
      <GithubRepositorySettings
        instanceId="1"
        config={GITHUB_REPOSITORY_DEFAULT_CONFIG}
        onChange={() => undefined}
        integrationsClient={{
          list: async () => ({ integrations: [] }),
          create: async () => {
            throw new Error("unused");
          },
          update: async () => {
            throw new Error("unused");
          },
          remove: async () => undefined,
        }}
      />,
    );
    expect(document.querySelector('input[placeholder="octocat"]')).toBeTruthy();
    expect(document.querySelector('input[placeholder="hello-world"]')).toBeTruthy();
  });
});
