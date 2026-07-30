import type {
  GithubReleasePayload,
  GithubReleasesAdapter,
  GithubReleasesFetchRequest,
  GithubReleasesFetchResult,
} from "@dashora/widget-sdk/widgets/github-releases/server";
import {
  GithubAdapterError,
  type GithubLanguageShare,
  type GithubRepositoryAdapter,
  type GithubRepositoryFetchRequest,
  type GithubRepositoryFetchResult,
  type GithubRepositoryPayload,
  buildLatestActivitySummary,
} from "@dashora/widget-sdk/widgets/github-repository/server";
import { type ProviderError, isProviderError } from "../errors.js";
import type { ProviderPlatform } from "../platform.js";

const GITHUB_API_BASE = "https://api.github.com";
const API_VERSION = "2022-11-28";

type GithubRepoResponse = {
  name?: string;
  full_name?: string;
  description?: string | null;
  html_url?: string;
  stargazers_count?: number;
  forks_count?: number;
  open_issues_count?: number;
  language?: string | null;
  private?: boolean;
  pushed_at?: string | null;
  updated_at?: string | null;
  owner?: { login?: string };
};

type GithubPullResponse = Array<{ id?: number }>;

type GithubReleaseResponse = Array<{
  id?: number;
  tag_name?: string;
  name?: string | null;
  html_url?: string;
  published_at?: string | null;
  prerelease?: boolean;
  draft?: boolean;
}>;

type GithubLanguagesResponse = Record<string, number>;

function githubHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": API_VERSION,
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

function providerIdFor(
  token: string | null | undefined,
  credentialId: string | null | undefined,
): string {
  if (credentialId) {
    return `github:${credentialId}`;
  }
  if (token) {
    return "github:env";
  }
  return "github";
}

function toIsoOrNull(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    return null;
  }
  return new Date(ms).toISOString();
}

function mapGithubHttpError(error: ProviderError, authenticated: boolean): GithubAdapterError {
  const status = error.statusCode;
  if (error.code === "rate_limited" || status === 429) {
    return new GithubAdapterError(
      "rate_limited",
      authenticated
        ? "GitHub API rate limit exceeded. Try again later."
        : "GitHub API rate limit exceeded. Add a personal access token to raise limits.",
      { statusCode: status ?? 429, cause: error },
    );
  }
  if (status === 401) {
    return new GithubAdapterError(
      "unauthorized",
      "GitHub rejected the access token. Update the token in settings.",
      { statusCode: 401, cause: error },
    );
  }
  if (status === 403) {
    // GitHub often returns 403 for rate limits without a proper 429.
    const message = error.message.toLowerCase();
    if (message.includes("rate") || message.includes("abuse")) {
      return new GithubAdapterError(
        "rate_limited",
        authenticated
          ? "GitHub API rate limit exceeded. Try again later."
          : "GitHub API rate limit exceeded. Add a personal access token to raise limits.",
        { statusCode: 403, cause: error },
      );
    }
    return new GithubAdapterError(
      authenticated ? "private" : "private",
      authenticated
        ? "Access to this repository was denied. Check the token permissions."
        : "Repository is private or access was denied. Add a GitHub token with access.",
      { statusCode: 403, cause: error },
    );
  }
  if (status === 404) {
    return new GithubAdapterError(
      authenticated ? "not_found" : "private",
      authenticated
        ? "Repository not found."
        : "Repository not found or is private. Add a GitHub token to access private repositories.",
      { statusCode: 404, cause: error },
    );
  }
  return new GithubAdapterError("fetch_failed", "Could not load data from GitHub.", {
    ...(status !== undefined ? { statusCode: status } : {}),
    cause: error,
  });
}

function wrapError(error: unknown, authenticated: boolean): never {
  if (error instanceof GithubAdapterError) {
    throw error;
  }
  if (isProviderError(error)) {
    throw mapGithubHttpError(error, authenticated);
  }
  throw new GithubAdapterError("fetch_failed", "Could not load data from GitHub.", {
    cause: error,
  });
}

function parseLinkLastPage(linkHeader: string | undefined): number | null {
  if (!linkHeader) {
    return null;
  }
  const match = linkHeader.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/i);
  if (!match?.[1]) {
    return null;
  }
  const page = Number.parseInt(match[1], 10);
  return Number.isFinite(page) && page > 0 ? page : null;
}

function languageShares(raw: GithubLanguagesResponse): GithubLanguageShare[] {
  const entries = Object.entries(raw).filter(([, bytes]) => typeof bytes === "number" && bytes > 0);
  const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0);
  if (total <= 0) {
    return [];
  }
  return entries
    .map(([name, bytes]) => ({
      name: name.slice(0, 80),
      bytes,
      percentage: Math.round((bytes / total) * 1000) / 10,
    }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 12);
}

async function githubJson<T>(
  platform: ProviderPlatform,
  options: {
    path: string;
    token?: string | null;
    credentialId?: string | null;
    signal?: AbortSignal;
    forceRefresh?: boolean;
    ttlSeconds: number;
    swrSeconds: number;
  },
): Promise<{
  data: T;
  cacheStatus: GithubRepositoryFetchResult["cacheStatus"];
  headers: Record<string, string>;
}> {
  const url = `${GITHUB_API_BASE}${options.path}`;
  const providerId = providerIdFor(options.token, options.credentialId);
  try {
    const { data, result } = await platform.fetchJson<T>({
      providerId,
      url,
      headers: githubHeaders(options.token),
      ...(options.signal ? { signal: options.signal } : {}),
      ...(options.forceRefresh !== undefined ? { forceRefresh: options.forceRefresh } : {}),
      cachePolicy: {
        ttlSeconds: options.ttlSeconds,
        staleWhileRevalidateSeconds: options.swrSeconds,
      },
    });
    return {
      data,
      cacheStatus: result.cacheStatus,
      headers: result.response.headers,
    };
  } catch (error) {
    wrapError(error, Boolean(options.token));
  }
}

export function createGithubRepositoryAdapter(platform: ProviderPlatform): GithubRepositoryAdapter {
  return {
    id: "github",

    async fetchRepository(
      request: GithubRepositoryFetchRequest,
    ): Promise<GithubRepositoryFetchResult> {
      const now = request.now ?? new Date();
      const owner = encodeURIComponent(request.owner);
      const repo = encodeURIComponent(request.repo);
      const token = request.token ?? null;
      const authOpts = {
        token,
        ...(request.credentialId !== undefined ? { credentialId: request.credentialId } : {}),
        ...(request.signal ? { signal: request.signal } : {}),
        ...(request.forceRefresh !== undefined ? { forceRefresh: request.forceRefresh } : {}),
      };

      const repoResult = await githubJson<GithubRepoResponse>(platform, {
        path: `/repos/${owner}/${repo}`,
        ...authOpts,
        ttlSeconds: 120,
        swrSeconds: 900,
      });

      const pullsResult = await githubJson<GithubPullResponse>(platform, {
        path: `/repos/${owner}/${repo}/pulls?state=open&per_page=1`,
        ...authOpts,
        ttlSeconds: 120,
        swrSeconds: 900,
      });

      let languages: GithubLanguageShare[] = [];
      let languagesCache = repoResult.cacheStatus;
      if (request.includeLanguages !== false) {
        try {
          const languagesResult = await githubJson<GithubLanguagesResponse>(platform, {
            path: `/repos/${owner}/${repo}/languages`,
            ...authOpts,
            ttlSeconds: 600,
            swrSeconds: 3600,
          });
          languages = languageShares(languagesResult.data);
          languagesCache = languagesResult.cacheStatus;
        } catch {
          languages = [];
        }
      }

      const openIssuesTotal =
        typeof repoResult.data.open_issues_count === "number"
          ? Math.max(0, Math.trunc(repoResult.data.open_issues_count))
          : 0;
      const openPullRequests =
        parseLinkLastPage(pullsResult.headers["link"] ?? pullsResult.headers["Link"]) ??
        (Array.isArray(pullsResult.data) ? pullsResult.data.length : 0);
      const openIssues = Math.max(0, openIssuesTotal - openPullRequests);

      const pushedAt = toIsoOrNull(repoResult.data.pushed_at);
      const updatedAt = toIsoOrNull(repoResult.data.updated_at);
      const ownerLogin = repoResult.data.owner?.login?.trim() || request.owner;
      const name = repoResult.data.name?.trim() || request.repo;
      const fullName = repoResult.data.full_name?.trim() || `${ownerLogin}/${name}`;
      const htmlUrl =
        typeof repoResult.data.html_url === "string" && repoResult.data.html_url.startsWith("http")
          ? repoResult.data.html_url
          : `https://github.com/${ownerLogin}/${name}`;

      const repository: GithubRepositoryPayload = {
        owner: ownerLogin.slice(0, 39),
        name: name.slice(0, 100),
        fullName: fullName.slice(0, 140),
        description:
          typeof repoResult.data.description === "string"
            ? repoResult.data.description.slice(0, 500)
            : null,
        htmlUrl,
        stars:
          typeof repoResult.data.stargazers_count === "number"
            ? Math.max(0, Math.trunc(repoResult.data.stargazers_count))
            : 0,
        forks:
          typeof repoResult.data.forks_count === "number"
            ? Math.max(0, Math.trunc(repoResult.data.forks_count))
            : 0,
        openIssues,
        openPullRequests,
        primaryLanguage:
          typeof repoResult.data.language === "string"
            ? repoResult.data.language.slice(0, 80)
            : null,
        languages,
        pushedAt,
        updatedAt,
        latestActivitySummary: buildLatestActivitySummary(pushedAt, updatedAt, now.getTime()),
        isPrivate: Boolean(repoResult.data.private),
        providerId: "github",
        fetchedAt: now.toISOString(),
        authenticated: Boolean(token),
      };

      const cacheStatuses = [repoResult.cacheStatus, pullsResult.cacheStatus, languagesCache];
      const cacheStatus = cacheStatuses.includes("stale")
        ? "stale"
        : cacheStatuses.includes("bypass")
          ? "bypass"
          : cacheStatuses.every((status) => status === "hit")
            ? "hit"
            : "miss";

      return { repository, cacheStatus };
    },
  };
}

export function createGithubReleasesAdapter(platform: ProviderPlatform): GithubReleasesAdapter {
  return {
    id: "github",

    async fetchLatestRelease(
      request: GithubReleasesFetchRequest,
    ): Promise<GithubReleasesFetchResult> {
      const now = request.now ?? new Date();
      const owner = encodeURIComponent(request.owner);
      const repo = encodeURIComponent(request.repo);
      const token = request.token ?? null;
      const result = await githubJson<GithubReleaseResponse>(platform, {
        path: `/repos/${owner}/${repo}/releases?per_page=30`,
        token,
        ...(request.credentialId !== undefined ? { credentialId: request.credentialId } : {}),
        ...(request.signal ? { signal: request.signal } : {}),
        ...(request.forceRefresh !== undefined ? { forceRefresh: request.forceRefresh } : {}),
        ttlSeconds: 180,
        swrSeconds: 1200,
      });

      const releases = Array.isArray(result.data) ? result.data : [];
      const selected = releases.find((item) => {
        if (item.draft) {
          return false;
        }
        if (!request.includePrereleases && item.prerelease) {
          return false;
        }
        return typeof item.tag_name === "string" && item.tag_name.length > 0;
      });

      if (
        !selected ||
        typeof selected.id !== "number" ||
        !selected.tag_name ||
        !selected.html_url
      ) {
        return { release: null, cacheStatus: result.cacheStatus };
      }

      const release: GithubReleasePayload = {
        id: String(selected.id),
        tagName: selected.tag_name.slice(0, 120),
        name: (selected.name?.trim() || selected.tag_name).slice(0, 200),
        htmlUrl: selected.html_url,
        publishedAt: toIsoOrNull(selected.published_at),
        prerelease: Boolean(selected.prerelease),
        draft: Boolean(selected.draft),
      };

      void now;
      return { release, cacheStatus: result.cacheStatus };
    },
  };
}

export function createGithubAdapters(platform: ProviderPlatform): {
  repository: GithubRepositoryAdapter;
  releases: GithubReleasesAdapter;
} {
  return {
    repository: createGithubRepositoryAdapter(platform),
    releases: createGithubReleasesAdapter(platform),
  };
}
