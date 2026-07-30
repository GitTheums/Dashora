import type { WidgetCacheStatus } from "../../cache.js";
import { defineWidgetProvider } from "../../provider.js";
import { formatGithubFullName } from "../_shared/github-names.js";
import { isGithubAdapterError } from "./adapter.js";
import type { GithubReleasesAdapter } from "./adapter.js";
import {
  type GithubReleaseItem,
  type GithubReleaseRepoResult,
  type GithubReleasesConfig,
  type GithubReleasesData,
  githubReleasesConfigSchema,
  githubReleasesDataSchema,
} from "./config.js";
import { GITHUB_RELEASES_WIDGET_ID } from "./definition.js";

export type GithubReleasesProviderDeps = {
  adapter: GithubReleasesAdapter;
  resolveDefaultToken?: () => string | null;
};

function mergeCacheStatus(statuses: WidgetCacheStatus[]): WidgetCacheStatus {
  if (statuses.length === 0) {
    return "miss";
  }
  if (statuses.every((status) => status === "hit")) {
    return "hit";
  }
  if (statuses.some((status) => status === "stale")) {
    return "stale";
  }
  if (statuses.some((status) => status === "bypass")) {
    return "bypass";
  }
  return "miss";
}

async function resolveToken(
  ctx: {
    credentialId?: string;
    getSecret?: (credentialId: string) => Promise<string | null>;
  },
  config: GithubReleasesConfig,
  resolveDefaultToken?: () => string | null,
): Promise<{ token: string | null; missingCredential: boolean }> {
  const credentialId = config.credentialId ?? ctx.credentialId ?? null;
  if (credentialId) {
    if (!ctx.getSecret) {
      return { token: null, missingCredential: true };
    }
    const secret = await ctx.getSecret(credentialId);
    if (!secret) {
      return { token: null, missingCredential: true };
    }
    return { token: secret, missingCredential: false };
  }
  return {
    token: resolveDefaultToken?.() ?? null,
    missingCredential: false,
  };
}

function errorMessage(error: unknown): { message: string; errorCode: string } {
  if (isGithubAdapterError(error)) {
    switch (error.code) {
      case "not_found":
        return { message: error.message, errorCode: "github_repository_not_found" };
      case "private":
        return { message: error.message, errorCode: "github_repository_private" };
      case "rate_limited":
        return { message: error.message, errorCode: "github_rate_limited" };
      case "unauthorized":
        return { message: error.message, errorCode: "github_unauthorized" };
      default:
        return { message: error.message, errorCode: "github_releases_fetch_failed" };
    }
  }
  return {
    message: "Could not load releases for this repository.",
    errorCode: "github_releases_fetch_failed",
  };
}

export function createGithubReleasesProvider(deps: GithubReleasesProviderDeps) {
  return defineWidgetProvider<GithubReleasesConfig, GithubReleasesData>({
    id: GITHUB_RELEASES_WIDGET_ID,
    fetch: async (ctx) => {
      const config = githubReleasesConfigSchema.parse(ctx.config);

      if (!config.enabled) {
        return { state: "disabled", message: "GitHub Releases is disabled in settings." };
      }

      if (config.repositories.length === 0) {
        return {
          state: "configuration-required",
          message: "Add at least one repository in settings.",
        };
      }

      const { token, missingCredential } = await resolveToken(
        ctx,
        config,
        deps.resolveDefaultToken,
      );
      if (missingCredential) {
        return {
          state: "configuration-required",
          message: "The linked GitHub credential is missing. Update the token in settings.",
        };
      }

      const now = ctx.now?.() ?? new Date();
      const repoResults: GithubReleaseRepoResult[] = [];
      const releases: GithubReleaseItem[] = [];
      const cacheStatuses: WidgetCacheStatus[] = [];
      let failedRepoCount = 0;
      let rateLimitMessage: string | null = null;

      await Promise.all(
        config.repositories.map(async (repoConfig) => {
          const fullName = formatGithubFullName(repoConfig.owner, repoConfig.repo);
          try {
            const result = await deps.adapter.fetchLatestRelease({
              owner: repoConfig.owner,
              repo: repoConfig.repo,
              includePrereleases: config.includePrereleases,
              token,
              credentialId: config.credentialId,
              ...(ctx.signal ? { signal: ctx.signal } : {}),
              ...(ctx.forceRefresh !== undefined ? { forceRefresh: ctx.forceRefresh } : {}),
              ...(ctx.now ? { now: ctx.now() } : {}),
            });
            cacheStatuses.push(result.cacheStatus);

            if (!result.release) {
              repoResults.push({
                id: repoConfig.id,
                owner: repoConfig.owner,
                repo: repoConfig.repo,
                fullName,
                status: "empty",
                message: config.includePrereleases
                  ? "No releases found for this repository."
                  : "No stable releases found. Enable prereleases in settings to include them.",
                cacheStatus: result.cacheStatus,
              });
              return;
            }

            releases.push({
              id: `${repoConfig.id}:${result.release.id}`,
              repoId: repoConfig.id,
              owner: repoConfig.owner,
              repo: repoConfig.repo,
              fullName,
              tagName: result.release.tagName,
              name: result.release.name,
              htmlUrl: result.release.htmlUrl,
              publishedAt: result.release.publishedAt,
              prerelease: result.release.prerelease,
              draft: result.release.draft,
            });
            repoResults.push({
              id: repoConfig.id,
              owner: repoConfig.owner,
              repo: repoConfig.repo,
              fullName,
              status: "ok",
              cacheStatus: result.cacheStatus,
            });
          } catch (error) {
            failedRepoCount += 1;
            if (isGithubAdapterError(error) && error.code === "rate_limited") {
              rateLimitMessage = error.message;
            }
            const mapped = errorMessage(error);
            repoResults.push({
              id: repoConfig.id,
              owner: repoConfig.owner,
              repo: repoConfig.repo,
              fullName,
              status: "error",
              message: mapped.message,
            });
          }
        }),
      );

      const orderedRepos = config.repositories
        .map((repo) => repoResults.find((result) => result.id === repo.id))
        .filter((result): result is GithubReleaseRepoResult => Boolean(result));

      const orderedReleases = config.repositories
        .map((repo) => releases.find((item) => item.repoId === repo.id))
        .filter((item): item is GithubReleaseItem => Boolean(item));

      const data = githubReleasesDataSchema.parse({
        compactMode: config.compactMode,
        layout: config.compactMode ? "compact" : config.layout,
        includePrereleases: config.includePrereleases,
        openInNewTab: config.openInNewTab,
        releases: orderedReleases,
        repositories: orderedRepos,
        failedRepoCount,
        fetchedAt: now.toISOString(),
        authenticated: Boolean(token),
      });

      const cacheStatus = mergeCacheStatus(cacheStatuses);

      if (rateLimitMessage && orderedReleases.length === 0) {
        return {
          state: "error",
          data,
          message: rateLimitMessage,
          errorCode: "github_rate_limited",
          cacheStatus,
        };
      }

      if (orderedReleases.length === 0 && failedRepoCount === config.repositories.length) {
        const firstError = orderedRepos.find((repo) => repo.status === "error");
        return {
          state: "error",
          data,
          message: firstError?.message ?? "All configured repositories failed to load.",
          errorCode: "github_releases_all_failed",
          cacheStatus,
        };
      }

      if (orderedReleases.length === 0) {
        return {
          state: "empty",
          data,
          message:
            failedRepoCount > 0
              ? "No releases to show. Some repositories failed — check settings."
              : config.includePrereleases
                ? "No releases were found for the configured repositories."
                : "No stable releases found. Enable prereleases to include them.",
          cacheStatus,
        };
      }

      if (cacheStatus === "stale" || failedRepoCount > 0) {
        return {
          state: "stale",
          data,
          message:
            failedRepoCount > 0
              ? `Showing available releases. ${failedRepoCount} repositor${failedRepoCount === 1 ? "y" : "ies"} failed.`
              : "Showing last good releases while a refresh is due.",
          cacheStatus: cacheStatus === "stale" ? "stale" : cacheStatus,
        };
      }

      if (ctx.forceRefresh) {
        return {
          state: "refreshing",
          data,
          message: "Refreshing releases…",
          cacheStatus,
        };
      }

      return {
        state: "success",
        data,
        cacheStatus,
      };
    },
  });
}
