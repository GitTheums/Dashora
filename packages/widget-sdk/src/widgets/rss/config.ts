import { z } from "zod";
import { newConfigEntryId } from "../_shared/ids.js";

export const rssLayoutSchema = z.enum(["compact", "detailed", "cards"]);
export type RssLayout = z.infer<typeof rssLayoutSchema>;

const httpsUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => /^https?:\/\//i.test(value), "Feed URLs must use http or https")
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return !parsed.username && !parsed.password;
    } catch {
      return false;
    }
  }, "Feed URLs must not include credentials");

export const rssFeedConfigSchema = z.object({
  id: z.string().uuid(),
  url: httpsUrlSchema,
  titleOverride: z.string().trim().max(80).optional().default(""),
  itemLimit: z.number().int().min(1).max(50).optional(),
});

export type RssFeedConfig = z.infer<typeof rssFeedConfigSchema>;

export const rssConfigSchema = z.object({
  feeds: z.array(rssFeedConfigSchema).max(10).default([]),
  /** Global cap after per-feed limits and deduplication. */
  maxItems: z.number().int().min(1).max(100).default(20),
  /** Default per-feed item limit when a feed omits `itemLimit`. */
  defaultItemLimit: z.number().int().min(1).max(50).default(10),
  layout: rssLayoutSchema.default("detailed"),
  showThumbnails: z.boolean().default(true),
  dedupeLinks: z.boolean().default(true),
  openInNewTab: z.boolean().default(true),
  enabled: z.boolean().default(true),
});

export type RssConfig = z.infer<typeof rssConfigSchema>;

export const RSS_DEFAULT_CONFIG: RssConfig = rssConfigSchema.parse({});

export const rssFeedStatusSchema = z.enum(["ok", "empty", "error"]);
export type RssFeedStatus = z.infer<typeof rssFeedStatusSchema>;

export const rssFeedResultSchema = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  title: z.string().min(1).max(120),
  status: rssFeedStatusSchema,
  message: z.string().max(240).optional(),
  itemCount: z.number().int().nonnegative(),
  cacheStatus: z.enum(["hit", "miss", "stale", "bypass"]).optional(),
});

export type RssFeedResult = z.infer<typeof rssFeedResultSchema>;

export const rssItemSchema = z.object({
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(240),
  link: z.string().url().nullable(),
  summary: z.string().max(500).optional().default(""),
  publishedAt: z.string().datetime({ offset: true }).nullable(),
  feedId: z.string().uuid(),
  feedTitle: z.string().min(1).max(120),
  thumbnailUrl: z.string().url().nullable(),
});

export type RssItem = z.infer<typeof rssItemSchema>;

export const rssDataSchema = z.object({
  layout: rssLayoutSchema,
  showThumbnails: z.boolean(),
  openInNewTab: z.boolean(),
  items: z.array(rssItemSchema).max(100),
  feeds: z.array(rssFeedResultSchema).max(10),
  fetchedAt: z.string().datetime({ offset: true }),
  failedFeedCount: z.number().int().nonnegative(),
});

export type RssData = z.infer<typeof rssDataSchema>;

export function newRssFeedId(): string {
  return newConfigEntryId();
}
