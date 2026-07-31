import { z } from "zod";

export const hackerNewsFeedSchema = z.enum(["top", "new", "best", "ask", "show", "jobs"]);
export type HackerNewsFeed = z.infer<typeof hackerNewsFeedSchema>;

export const hackerNewsLayoutSchema = z.enum(["compact", "rich"]);
export type HackerNewsLayout = z.infer<typeof hackerNewsLayoutSchema>;

export const hackerNewsConfigSchema = z.object({
  feed: hackerNewsFeedSchema.default("top"),
  maxItems: z.number().int().min(1).max(50).default(15),
  layout: hackerNewsLayoutSchema.default("rich"),
  showScore: z.boolean().default(true),
  showCommentCount: z.boolean().default(true),
  openInNewTab: z.boolean().default(true),
  enabled: z.boolean().default(true),
});

export type HackerNewsConfig = z.infer<typeof hackerNewsConfigSchema>;

export const HACKER_NEWS_DEFAULT_CONFIG: HackerNewsConfig = hackerNewsConfigSchema.parse({});

export const hackerNewsItemSchema = z.object({
  id: z.string().min(1).max(32),
  title: z.string().min(1).max(240),
  url: z.string().url().nullable(),
  hnUrl: z.string().url(),
  score: z.number().int().nonnegative(),
  commentCount: z.number().int().nonnegative(),
  author: z.string().min(1).max(80),
  publishedAt: z.string().datetime({ offset: true }).nullable(),
  domain: z.string().max(120).nullable(),
});

export type HackerNewsItem = z.infer<typeof hackerNewsItemSchema>;

export const hackerNewsDataSchema = z.object({
  feed: hackerNewsFeedSchema,
  layout: hackerNewsLayoutSchema,
  showScore: z.boolean(),
  showCommentCount: z.boolean(),
  openInNewTab: z.boolean(),
  items: z.array(hackerNewsItemSchema).max(50),
  fetchedAt: z.string().datetime({ offset: true }),
});

export type HackerNewsData = z.infer<typeof hackerNewsDataSchema>;

export const HACKER_NEWS_FEED_LABELS: Record<HackerNewsFeed, string> = {
  top: "Top",
  new: "New",
  best: "Best",
  ask: "Ask HN",
  show: "Show HN",
  jobs: "Jobs",
};
