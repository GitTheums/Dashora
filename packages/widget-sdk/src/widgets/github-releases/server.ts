export {
  GITHUB_RELEASES_DEFAULT_CONFIG,
  githubReleasesConfigSchema,
  githubReleasesDataSchema,
  githubReleaseRepoConfigSchema,
  githubReleaseItemSchema,
  githubReleaseRepoResultSchema,
  githubReleasesLayoutSchema,
  newGithubRepoEntryId,
  type GithubReleasesConfig,
  type GithubReleasesData,
  type GithubReleaseRepoConfig,
  type GithubReleaseItem,
  type GithubReleaseRepoResult,
  type GithubReleasesLayout,
  type GithubReleaseRepoStatus,
} from "./config.js";
export { GITHUB_RELEASES_WIDGET_ID, githubReleasesDefinition } from "./definition.js";
export {
  createGithubReleasesProvider,
  type GithubReleasesProviderDeps,
} from "./provider.js";
export {
  GithubAdapterError,
  isGithubAdapterError,
  type GithubAdapterErrorCode,
  type GithubReleasesAdapter,
  type GithubReleasePayload,
  type GithubReleasesFetchRequest,
  type GithubReleasesFetchResult,
} from "./adapter.js";
