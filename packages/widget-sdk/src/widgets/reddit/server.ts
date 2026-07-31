export {
  REDDIT_DEFAULT_CONFIG,
  REDDIT_SORT_LABELS,
  REDDIT_TIME_FRAME_LABELS,
  isRedditConfigured,
  newRedditSubredditId,
  redditConfigSchema,
  redditDataSchema,
  redditItemSchema,
  redditLayoutSchema,
  redditSortSchema,
  redditSourceResultSchema,
  redditSubredditConfigSchema,
  redditTimeFrameSchema,
  type RedditConfig,
  type RedditData,
  type RedditItem,
  type RedditLayout,
  type RedditSort,
  type RedditSourceResult,
  type RedditSourceStatus,
  type RedditSubredditConfig,
  type RedditTimeFrame,
} from "./config.js";
export { REDDIT_WIDGET_ID, redditDefinition } from "./definition.js";
export { createRedditProvider, type RedditProviderDeps } from "./provider.js";
export type {
  RedditAdapter,
  RedditCredentials,
  RedditPostPayload,
  RedditSubredditFetchRequest,
  RedditSubredditFetchResult,
} from "./adapter.js";
export { FeedAdapterError, isFeedAdapterError } from "./adapter.js";
