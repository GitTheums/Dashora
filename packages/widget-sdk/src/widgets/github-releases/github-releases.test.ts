import { describe, expect, it, vi } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import { GithubAdapterError, type GithubReleasesAdapter } from "./adapter.js";
import { GITHUB_RELEASES_DEFAULT_CONFIG, githubReleasesConfigSchema } from "./config.js";
import { githubReleasesDefinition } from "./definition.js";
import { createGithubReleasesProvider } from "./provider.js";

const repoId = "11111111-1111-4111-8111-111111111111";

function createMockAdapter(overrides: Partial<GithubReleasesAdapter> = {}): GithubReleasesAdapter {
  return {
    id: "mock",
    fetchLatestRelease: vi.fn(async () => ({
      release: {
        id: "1",
        tagName: "v1.0.0",
        name: "v1.0.0",
        htmlUrl: "https://github.com/dashora/dashora/releases/tag/v1.0.0",
        publishedAt: "2026-07-29T12:00:00.000Z",
        prerelease: false,
        draft: false,
      },
      cacheStatus: "miss" as const,
    })),
    ...overrides,
  };
}

describe("github releases definition", () => {
  it("covers every required runtime state", () => {
    expect(githubReleasesDefinition.states).toEqual(REQUIRED_WIDGET_STATES);
    expect(githubReleasesDefinition.id).toBe("github-releases");
  });

  it("parses default config", () => {
    expect(githubReleasesConfigSchema.parse({})).toEqual(GITHUB_RELEASES_DEFAULT_CONFIG);
  });
});

describe("github releases provider", () => {
  it("returns configuration-required without repositories", async () => {
    const provider = createGithubReleasesProvider({ adapter: createMockAdapter() });
    const result = await provider.fetch({
      instanceId: "r1",
      config: GITHUB_RELEASES_DEFAULT_CONFIG,
    });
    expect(result.state).toBe("configuration-required");
  });

  it("returns success with latest releases", async () => {
    const provider = createGithubReleasesProvider({ adapter: createMockAdapter() });
    const result = await provider.fetch({
      instanceId: "r2",
      config: {
        ...GITHUB_RELEASES_DEFAULT_CONFIG,
        repositories: [{ id: repoId, owner: "dashora", repo: "dashora" }],
      },
    });
    expect(result.state).toBe("success");
    expect(result.data?.releases[0]?.tagName).toBe("v1.0.0");
  });

  it("returns error for a missing repository", async () => {
    const adapter = createMockAdapter({
      fetchLatestRelease: vi.fn(async () => {
        throw new GithubAdapterError("not_found", "Repository not found.");
      }),
    });
    const provider = createGithubReleasesProvider({ adapter });
    const result = await provider.fetch({
      instanceId: "r3",
      config: {
        ...GITHUB_RELEASES_DEFAULT_CONFIG,
        repositories: [{ id: repoId, owner: "dashora", repo: "missing" }],
      },
    });
    expect(result.state).toBe("error");
    expect(result.errorCode).toBe("github_releases_all_failed");
  });

  it("returns a rate-limit-aware error", async () => {
    const adapter = createMockAdapter({
      fetchLatestRelease: vi.fn(async () => {
        throw new GithubAdapterError(
          "rate_limited",
          "GitHub API rate limit exceeded. Add a personal access token to raise limits.",
        );
      }),
    });
    const provider = createGithubReleasesProvider({ adapter });
    const result = await provider.fetch({
      instanceId: "r4",
      config: {
        ...GITHUB_RELEASES_DEFAULT_CONFIG,
        repositories: [{ id: repoId, owner: "dashora", repo: "dashora" }],
      },
    });
    expect(result.state).toBe("error");
    expect(result.errorCode).toBe("github_rate_limited");
  });

  it("returns a private-repository error", async () => {
    const adapter = createMockAdapter({
      fetchLatestRelease: vi.fn(async () => {
        throw new GithubAdapterError(
          "private",
          "Repository not found or is private. Add a GitHub token to access private repositories.",
        );
      }),
    });
    const provider = createGithubReleasesProvider({ adapter });
    const result = await provider.fetch({
      instanceId: "r5",
      config: {
        ...GITHUB_RELEASES_DEFAULT_CONFIG,
        repositories: [{ id: repoId, owner: "dashora", repo: "secret" }],
      },
    });
    expect(result.state).toBe("error");
    expect(result.data?.repositories[0]?.message).toMatch(/private/i);
  });

  it("returns stale when the adapter reports stale cache", async () => {
    const adapter = createMockAdapter({
      fetchLatestRelease: vi.fn(async () => ({
        release: {
          id: "1",
          tagName: "v1.0.0",
          name: "v1.0.0",
          htmlUrl: "https://github.com/dashora/dashora/releases/tag/v1.0.0",
          publishedAt: "2026-07-29T12:00:00.000Z",
          prerelease: false,
          draft: false,
        },
        cacheStatus: "stale" as const,
      })),
    });
    const provider = createGithubReleasesProvider({ adapter });
    const result = await provider.fetch({
      instanceId: "r6",
      config: {
        ...GITHUB_RELEASES_DEFAULT_CONFIG,
        repositories: [{ id: repoId, owner: "dashora", repo: "dashora" }],
      },
    });
    expect(result.state).toBe("stale");
    expect(result.cacheStatus).toBe("stale");
  });

  it("respects the prerelease toggle when empty", async () => {
    const adapter = createMockAdapter({
      fetchLatestRelease: vi.fn(async () => ({
        release: null,
        cacheStatus: "miss" as const,
      })),
    });
    const provider = createGithubReleasesProvider({ adapter });
    const result = await provider.fetch({
      instanceId: "r7",
      config: {
        ...GITHUB_RELEASES_DEFAULT_CONFIG,
        includePrereleases: false,
        repositories: [{ id: repoId, owner: "dashora", repo: "dashora" }],
      },
    });
    expect(result.state).toBe("empty");
    expect(result.message).toMatch(/prereleases/i);
  });
});
