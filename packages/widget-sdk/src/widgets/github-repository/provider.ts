import { defineWidgetProvider } from "../../provider.js";
import { githubOwnerSchema, githubRepoNameSchema } from "../_shared/github-names.js";
import {
  GithubAdapterError,
  type GithubRepositoryAdapter,
  isGithubAdapterError,
} from "./adapter.js";
import {
  type GithubRepositoryConfig,
  type GithubRepositoryData,
  githubRepositoryConfigSchema,
  githubRepositoryDataSchema,
  isGithubRepositoryConfigured,
} from "./config.js";
import { GITHUB_REPOSITORY_WIDGET_ID } from "./definition.js";

export type GithubRepositoryProviderDeps = {
  adapter: GithubRepositoryAdapter;
  /** Optional process-wide token used when the widget has no credentialId. */
  resolveDefaultToken?: () => string | null;
};

async function resolveToken(
  ctx: {
    credentialId?: string;
    getSecret?: (credentialId: string) => Promise<string | null>;
  },
  config: GithubRepositoryConfig,
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

function mapAdapterError(error: unknown): {
  state: "error";
  message: string;
  errorCode: string;
} {
  if (isGithubAdapterError(error)) {
    switch (error.code) {
      case "not_found":
        return {
          state: "error",
          message: error.message,
          errorCode: "github_repository_not_found",
        };
      case "private":
        return {
          state: "error",
          message: error.message,
          errorCode: "github_repository_private",
        };
      case "rate_limited":
        return {
          state: "error",
          message: error.message,
          errorCode: "github_rate_limited",
        };
      case "unauthorized":
        return {
          state: "error",
          message: error.message,
          errorCode: "github_unauthorized",
        };
      default:
        return {
          state: "error",
          message: error.message,
          errorCode: "github_repository_fetch_failed",
        };
    }
  }
  return {
    state: "error",
    message: "Could not load the GitHub repository.",
    errorCode: "github_repository_fetch_failed",
  };
}

export function createGithubRepositoryProvider(deps: GithubRepositoryProviderDeps) {
  return defineWidgetProvider<GithubRepositoryConfig, GithubRepositoryData>({
    id: GITHUB_REPOSITORY_WIDGET_ID,
    fetch: async (ctx) => {
      const config = githubRepositoryConfigSchema.parse(ctx.config);

      if (!config.enabled) {
        return { state: "disabled", message: "GitHub Repository is disabled in settings." };
      }

      if (!isGithubRepositoryConfigured(config)) {
        return {
          state: "configuration-required",
          message: "Set the repository owner and name in settings.",
        };
      }

      const ownerParsed = githubOwnerSchema.safeParse(config.owner);
      const repoParsed = githubRepoNameSchema.safeParse(config.repo);
      if (!ownerParsed.success || !repoParsed.success) {
        return {
          state: "configuration-required",
          message: "Enter a valid GitHub owner and repository name.",
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

      try {
        const result = await deps.adapter.fetchRepository({
          owner: ownerParsed.data,
          repo: repoParsed.data,
          token,
          credentialId: config.credentialId,
          includeLanguages: config.showLanguages,
          ...(ctx.signal ? { signal: ctx.signal } : {}),
          ...(ctx.forceRefresh !== undefined ? { forceRefresh: ctx.forceRefresh } : {}),
          ...(ctx.now ? { now: ctx.now() } : {}),
        });

        const data = githubRepositoryDataSchema.parse({
          ...result.repository,
          layout: config.layout,
          showDescription: config.showDescription,
          showLanguages: config.showLanguages,
          languages: config.showLanguages ? result.repository.languages : [],
          description: config.showDescription ? result.repository.description : null,
        });

        if (result.cacheStatus === "stale") {
          return {
            state: "stale",
            data,
            message: "Showing last good repository data while a refresh is due.",
            cacheStatus: "stale",
          };
        }

        if (ctx.forceRefresh) {
          return {
            state: "refreshing",
            data,
            message: "Refreshing repository…",
            cacheStatus: result.cacheStatus,
          };
        }

        return {
          state: "success",
          data,
          cacheStatus: result.cacheStatus,
        };
      } catch (error) {
        if (error instanceof GithubAdapterError) {
          return mapAdapterError(error);
        }
        return mapAdapterError(error);
      }
    },
  });
}
