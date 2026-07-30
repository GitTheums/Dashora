export {
  GITHUB_REPOSITORY_DEFAULT_CONFIG,
  githubRepositoryConfigSchema,
  githubRepositoryDataSchema,
  githubRepositoryLayoutSchema,
  githubLanguageShareSchema,
  isGithubRepositoryConfigured,
  type GithubRepositoryConfig,
  type GithubRepositoryData,
  type GithubRepositoryLayout,
  type GithubLanguageShare,
} from "./config.js";
export { GITHUB_REPOSITORY_WIDGET_ID, githubRepositoryDefinition } from "./definition.js";
export {
  createGithubRepositoryProvider,
  type GithubRepositoryProviderDeps,
} from "./provider.js";
export {
  GithubAdapterError,
  isGithubAdapterError,
  type GithubAdapterErrorCode,
  type GithubRepositoryAdapter,
  type GithubRepositoryPayload,
  type GithubRepositoryFetchRequest,
  type GithubRepositoryFetchResult,
} from "./adapter.js";
export {
  formatRelativeTimestamp,
  formatCompactCount,
  buildLatestActivitySummary,
} from "../_shared/github-format.js";
export {
  githubOwnerSchema,
  githubRepoNameSchema,
  githubRepoRefSchema,
  formatGithubFullName,
  parseGithubFullName,
  type GithubRepoRef,
} from "../_shared/github-names.js";
