import type { WidgetCacheStatus } from "../../cache.js";
import type { GithubLanguageShare } from "./config.js";

export type GithubRepositoryPayload = {
  owner: string;
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  stars: number;
  forks: number;
  openIssues: number;
  openPullRequests: number;
  primaryLanguage: string | null;
  languages: GithubLanguageShare[];
  pushedAt: string | null;
  updatedAt: string | null;
  latestActivitySummary: string;
  isPrivate: boolean;
  providerId: string;
  fetchedAt: string;
  authenticated: boolean;
};

export type GithubRepositoryFetchRequest = {
  owner: string;
  repo: string;
  token?: string | null;
  credentialId?: string | null;
  includeLanguages?: boolean;
  signal?: AbortSignal;
  forceRefresh?: boolean;
  now?: Date;
};

export type GithubRepositoryFetchResult = {
  repository: GithubRepositoryPayload;
  cacheStatus: WidgetCacheStatus;
};

/**
 * Pluggable GitHub repository upstream. Production uses the REST API; tests inject fakes.
 */
export type GithubRepositoryAdapter = {
  readonly id: string;
  fetchRepository: (request: GithubRepositoryFetchRequest) => Promise<GithubRepositoryFetchResult>;
};

export type GithubAdapterErrorCode =
  | "not_found"
  | "private"
  | "rate_limited"
  | "unauthorized"
  | "fetch_failed";

export class GithubAdapterError extends Error {
  readonly code: GithubAdapterErrorCode;
  readonly statusCode?: number;

  constructor(
    code: GithubAdapterErrorCode,
    message: string,
    options: { statusCode?: number; cause?: unknown } = {},
  ) {
    super(message);
    this.name = "GithubAdapterError";
    this.code = code;
    if (options.statusCode !== undefined) {
      this.statusCode = options.statusCode;
    }
    if (options.cause instanceof Error) {
      this.cause = options.cause;
    }
  }
}

export function isGithubAdapterError(error: unknown): error is GithubAdapterError {
  return error instanceof GithubAdapterError;
}
