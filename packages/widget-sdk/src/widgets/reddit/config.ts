import { z } from "zod";

export const redditSortSchema = z.enum(["hot", "new", "top", "rising"]);
export type RedditSort = z.infer<typeof redditSortSchema>;

export const redditTimeFrameSchema = z.enum(["hour", "day", "week", "month", "year", "all"]);
export type RedditTimeFrame = z.infer<typeof redditTimeFrameSchema>;

export const redditLayoutSchema = z.enum(["compact", "rich"]);
export type RedditLayout = z.infer<typeof redditLayoutSchema>;

const subredditNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(21)
  .regex(/^[A-Za-z0-9_]+$/, "Subreddit names may only contain letters, numbers, and underscores");

export const redditSubredditConfigSchema = z.object({
  id: z.string().uuid(),
  name: subredditNameSchema,
  sort: redditSortSchema.default("hot"),
  timeFrame: redditTimeFrameSchema.optional(),
  label: z.string().trim().max(80).optional().default(""),
  itemLimit: z.number().int().min(1).max(50).optional(),
});

export type RedditSubredditConfig = z.infer<typeof redditSubredditConfigSchema>;

export const redditConfigSchema = z.object({
  subreddits: z.array(redditSubredditConfigSchema).max(10).default([]),
  /** Global cap after per-subreddit limits. */
  maxItems: z.number().int().min(1).max(100).default(20),
  /** Default per-subreddit item limit when a subreddit omits `itemLimit`. */
  defaultItemLimit: z.number().int().min(1).max(50).default(10),
  layout: redditLayoutSchema.default("rich"),
  showThumbnails: z.boolean().default(true),
  showScore: z.boolean().default(true),
  showCommentCount: z.boolean().default(true),
  openInNewTab: z.boolean().default(true),
  enabled: z.boolean().default(true),
});

export type RedditConfig = z.infer<typeof redditConfigSchema>;

export const REDDIT_DEFAULT_CONFIG: RedditConfig = redditConfigSchema.parse({});

export const redditSourceStatusSchema = z.enum(["ok", "empty", "error"]);
export type RedditSourceStatus = z.infer<typeof redditSourceStatusSchema>;

export const redditSourceResultSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(21),
  label: z.string().max(80),
  status: redditSourceStatusSchema,
  message: z.string().max(240).optional(),
  itemCount: z.number().int().nonnegative(),
  cacheStatus: z.enum(["hit", "miss", "stale", "bypass"]).optional(),
});

export type RedditSourceResult = z.infer<typeof redditSourceResultSchema>;

export const redditItemSchema = z.object({
  id: z.string().min(1).max(32),
  title: z.string().min(1).max(240),
  url: z.string().url().nullable(),
  permalinkUrl: z.string().url(),
  score: z.number().int(),
  commentCount: z.number().int().nonnegative(),
  author: z.string().min(1).max(80),
  subreddit: z.string().min(1).max(21),
  publishedAt: z.string().datetime({ offset: true }).nullable(),
  thumbnailUrl: z.string().url().nullable(),
  sourceId: z.string().uuid(),
  sourceLabel: z.string().min(1).max(80),
});

export type RedditItem = z.infer<typeof redditItemSchema>;

export const redditDataSchema = z.object({
  layout: redditLayoutSchema,
  showThumbnails: z.boolean(),
  showScore: z.boolean(),
  showCommentCount: z.boolean(),
  openInNewTab: z.boolean(),
  items: z.array(redditItemSchema).max(100),
  sources: z.array(redditSourceResultSchema).max(10),
  fetchedAt: z.string().datetime({ offset: true }),
  failedSourceCount: z.number().int().nonnegative(),
});

export type RedditData = z.infer<typeof redditDataSchema>;

export const REDDIT_SORT_LABELS: Record<RedditSort, string> = {
  hot: "Hot",
  new: "New",
  top: "Top",
  rising: "Rising",
};

export const REDDIT_TIME_FRAME_LABELS: Record<RedditTimeFrame, string> = {
  hour: "Past hour",
  day: "Past day",
  week: "Past week",
  month: "Past month",
  year: "Past year",
  all: "All time",
};

export function isRedditConfigured(config: RedditConfig): boolean {
  return config.subreddits.length > 0;
}

export function newRedditSubredditId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `a${Date.now().toString(16).padStart(11, "0")}-1111-4111-8111-${Math.floor(
    Math.random() * 1e12,
  )
    .toString(16)
    .padStart(12, "0")}`;
}
