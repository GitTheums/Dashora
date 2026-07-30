import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import { GITHUB_RELEASES_DEFAULT_CONFIG, type GithubReleasesData } from "./config.js";
import { GithubReleasesRenderer } from "./renderer.js";

const repoId = "11111111-1111-4111-8111-111111111111";

const sampleData: GithubReleasesData = {
  compactMode: false,
  layout: "detailed",
  includePrereleases: false,
  openInNewTab: true,
  failedRepoCount: 0,
  fetchedAt: "2026-07-30T12:00:00.000Z",
  authenticated: false,
  repositories: [
    {
      id: repoId,
      owner: "dashora",
      repo: "dashora",
      fullName: "dashora/dashora",
      status: "ok",
      cacheStatus: "miss",
    },
  ],
  releases: [
    {
      id: `${repoId}:1`,
      repoId,
      owner: "dashora",
      repo: "dashora",
      fullName: "dashora/dashora",
      tagName: "v1.2.0",
      name: "Release 1.2.0",
      htmlUrl: "https://github.com/dashora/dashora/releases/tag/v1.2.0",
      publishedAt: "2026-07-29T12:00:00.000Z",
      prerelease: false,
      draft: false,
    },
  ],
};

afterEach(() => {
  cleanup();
});

describe("GithubReleasesRenderer", () => {
  it.each(REQUIRED_WIDGET_STATES)("renders state=%s", (state) => {
    render(
      <GithubReleasesRenderer
        instanceId="1"
        title="GitHub Releases"
        config={{
          ...GITHUB_RELEASES_DEFAULT_CONFIG,
          repositories: [{ id: repoId, owner: "dashora", repo: "dashora" }],
        }}
        state={state}
        {...(state === "success" || state === "empty" || state === "stale" || state === "refreshing"
          ? { data: sampleData }
          : {})}
        message={`msg-${state}`}
      />,
    );
    expect(
      document.querySelector(`[data-widget="github-releases"][data-state="${state}"]`),
    ).toBeTruthy();
  });

  it("renders release links", () => {
    render(
      <GithubReleasesRenderer
        instanceId="1"
        title="GitHub Releases"
        config={GITHUB_RELEASES_DEFAULT_CONFIG}
        state="success"
        data={sampleData}
      />,
    );
    expect(screen.getByText("Release 1.2.0")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Release 1.2.0" }).getAttribute("href")).toContain(
      "/releases/tag/v1.2.0",
    );
  });
});
