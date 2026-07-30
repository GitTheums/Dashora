import type { WidgetCacheStatus } from "../../cache.js";
import {
  GithubAdapterError,
  type GithubAdapterErrorCode,
  isGithubAdapterError,
} from "../github-repository/adapter.js";

export { GithubAdapterError, isGithubAdapterError, type GithubAdapterErrorCode };

export type GithubReleasePayload = {
  id: string;
  tagName: string;
  name: string;
  htmlUrl: string;
  publishedAt: string | null;
  prerelease: boolean;
  draft: boolean;
};

export type GithubReleasesFetchRequest = {
  owner: string;
  repo: string;
  includePrereleases: boolean;
  token?: string | null;
  credentialId?: string | null;
  signal?: AbortSignal;
  forceRefresh?: boolean;
  now?: Date;
};

export type GithubReleasesFetchResult = {
  release: GithubReleasePayload | null;
  cacheStatus: WidgetCacheStatus;
};

/**
 * Pluggable GitHub releases upstream. Production uses the REST API; tests inject fakes.
 */
export type GithubReleasesAdapter = {
  readonly id: string;
  fetchLatestRelease: (request: GithubReleasesFetchRequest) => Promise<GithubReleasesFetchResult>;
};
