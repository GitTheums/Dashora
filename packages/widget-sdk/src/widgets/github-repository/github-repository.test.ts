import { describe, expect, it, vi } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import { githubOwnerSchema, githubRepoNameSchema } from "../_shared/github-names.js";
import { GithubAdapterError, type GithubRepositoryAdapter } from "./adapter.js";
import {
  GITHUB_REPOSITORY_DEFAULT_CONFIG,
  type GithubRepositoryData,
  githubRepositoryConfigSchema,
} from "./config.js";
import { githubRepositoryDefinition } from "./definition.js";
import { createGithubRepositoryProvider } from "./provider.js";

function sampleRepository(now = "2026-07-30T12:00:00.000Z"): GithubRepositoryData {
  return {
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
    fetchedAt: now,
    authenticated: false,
  };
}

function createMockAdapter(
  overrides: Partial<GithubRepositoryAdapter> = {},
): GithubRepositoryAdapter {
  return {
    id: "mock",
    fetchRepository: vi.fn(async () => ({
      repository: {
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
        providerId: "github",
        fetchedAt: "2026-07-30T12:00:00.000Z",
        authenticated: false,
      },
      cacheStatus: "miss" as const,
    })),
    ...overrides,
  };
}

describe("github repository definition", () => {
  it("covers every required runtime state", () => {
    expect(githubRepositoryDefinition.states).toEqual(REQUIRED_WIDGET_STATES);
    expect(githubRepositoryDefinition.id).toBe("github-repository");
  });

  it("parses default config", () => {
    expect(githubRepositoryConfigSchema.parse({})).toEqual(GITHUB_REPOSITORY_DEFAULT_CONFIG);
  });

  it("validates owner and repository names", () => {
    expect(githubOwnerSchema.parse("octocat")).toBe("octocat");
    expect(githubRepoNameSchema.parse("hello-world")).toBe("hello-world");
    expect(() => githubOwnerSchema.parse("-bad")).toThrow();
    expect(() => githubRepoNameSchema.parse("has/slash")).toThrow();
  });
});

describe("github repository provider", () => {
  it("returns configuration-required without owner/repo", async () => {
    const provider = createGithubRepositoryProvider({ adapter: createMockAdapter() });
    const result = await provider.fetch({
      instanceId: "g1",
      config: GITHUB_REPOSITORY_DEFAULT_CONFIG,
    });
    expect(result.state).toBe("configuration-required");
  });

  it("returns success with repository data", async () => {
    const adapter = createMockAdapter();
    const provider = createGithubRepositoryProvider({ adapter });
    const result = await provider.fetch({
      instanceId: "g2",
      config: {
        ...GITHUB_REPOSITORY_DEFAULT_CONFIG,
        owner: "dashora",
        repo: "dashora",
      },
    });
    expect(result.state).toBe("success");
    expect(result.data?.stars).toBe(42);
    expect(result.data?.openPullRequests).toBe(2);
  });

  it("returns error for a missing repository", async () => {
    const adapter = createMockAdapter({
      fetchRepository: vi.fn(async () => {
        throw new GithubAdapterError("not_found", "Repository not found.");
      }),
    });
    const provider = createGithubRepositoryProvider({ adapter });
    const result = await provider.fetch({
      instanceId: "g3",
      config: { ...GITHUB_REPOSITORY_DEFAULT_CONFIG, owner: "dashora", repo: "missing" },
    });
    expect(result.state).toBe("error");
    expect(result.errorCode).toBe("github_repository_not_found");
  });

  it("returns a rate-limit-aware error", async () => {
    const adapter = createMockAdapter({
      fetchRepository: vi.fn(async () => {
        throw new GithubAdapterError(
          "rate_limited",
          "GitHub API rate limit exceeded. Add a personal access token to raise limits.",
        );
      }),
    });
    const provider = createGithubRepositoryProvider({ adapter });
    const result = await provider.fetch({
      instanceId: "g4",
      config: { ...GITHUB_REPOSITORY_DEFAULT_CONFIG, owner: "dashora", repo: "dashora" },
    });
    expect(result.state).toBe("error");
    expect(result.errorCode).toBe("github_rate_limited");
    expect(result.message).toMatch(/rate limit/i);
  });

  it("returns a private-repository error", async () => {
    const adapter = createMockAdapter({
      fetchRepository: vi.fn(async () => {
        throw new GithubAdapterError(
          "private",
          "Repository not found or is private. Add a GitHub token to access private repositories.",
        );
      }),
    });
    const provider = createGithubRepositoryProvider({ adapter });
    const result = await provider.fetch({
      instanceId: "g5",
      config: { ...GITHUB_REPOSITORY_DEFAULT_CONFIG, owner: "dashora", repo: "secret" },
    });
    expect(result.state).toBe("error");
    expect(result.errorCode).toBe("github_repository_private");
  });

  it("returns stale when the adapter reports stale cache", async () => {
    const sample = sampleRepository();
    const adapter = createMockAdapter({
      fetchRepository: vi.fn(async () => ({
        repository: {
          owner: sample.owner,
          name: sample.name,
          fullName: sample.fullName,
          description: sample.description,
          htmlUrl: sample.htmlUrl,
          stars: sample.stars,
          forks: sample.forks,
          openIssues: sample.openIssues,
          openPullRequests: sample.openPullRequests,
          primaryLanguage: sample.primaryLanguage,
          languages: sample.languages,
          pushedAt: sample.pushedAt,
          updatedAt: sample.updatedAt,
          latestActivitySummary: sample.latestActivitySummary,
          isPrivate: sample.isPrivate,
          providerId: sample.providerId,
          fetchedAt: sample.fetchedAt,
          authenticated: sample.authenticated,
        },
        cacheStatus: "stale" as const,
      })),
    });
    const provider = createGithubRepositoryProvider({ adapter });
    const result = await provider.fetch({
      instanceId: "g6",
      config: { ...GITHUB_REPOSITORY_DEFAULT_CONFIG, owner: "dashora", repo: "dashora" },
    });
    expect(result.state).toBe("stale");
    expect(result.cacheStatus).toBe("stale");
    expect(result.data?.fullName).toBe("dashora/dashora");
  });

  it("uses getSecret when credentialId is set", async () => {
    const adapter = createMockAdapter();
    const getSecret = vi.fn(async () => "ghp_test_token_value");
    const provider = createGithubRepositoryProvider({ adapter });
    const credentialId = "11111111-1111-4111-8111-111111111111";
    await provider.fetch({
      instanceId: "g7",
      config: {
        ...GITHUB_REPOSITORY_DEFAULT_CONFIG,
        owner: "dashora",
        repo: "dashora",
        credentialId,
      },
      getSecret,
    });
    expect(getSecret).toHaveBeenCalledWith(credentialId);
    expect(adapter.fetchRepository).toHaveBeenCalledWith(
      expect.objectContaining({ token: "ghp_test_token_value" }),
    );
  });
});
