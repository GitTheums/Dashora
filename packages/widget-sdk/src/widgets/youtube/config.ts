import { z } from "zod";
import { newConfigEntryId } from "../_shared/ids.js";

export const youtubeLayoutSchema = z.enum(["compact", "rich"]);
export type YoutubeLayout = z.infer<typeof youtubeLayoutSchema>;

const youtubeChannelIdSchema = z
  .string()
  .trim()
  .regex(/^UC[\w-]{20,}$/, "Channel ID must start with UC and be at least 22 characters");

export const youtubeChannelConfigSchema = z.object({
  id: z.string().uuid(),
  channelId: youtubeChannelIdSchema,
  label: z.string().trim().max(80).optional(),
  itemLimit: z.number().int().min(1).max(50).optional(),
});

export type YoutubeChannelConfig = z.infer<typeof youtubeChannelConfigSchema>;

export const youtubeConfigSchema = z.object({
  channels: z.array(youtubeChannelConfigSchema).max(10).default([]),
  maxItems: z.number().int().min(1).max(100).default(12),
  defaultItemLimit: z.number().int().min(1).max(50).default(6),
  layout: youtubeLayoutSchema.default("rich"),
  showThumbnails: z.boolean().default(true),
  openInNewTab: z.boolean().default(true),
  enabled: z.boolean().default(true),
});

export type YoutubeConfig = z.infer<typeof youtubeConfigSchema>;

export const YOUTUBE_DEFAULT_CONFIG: YoutubeConfig = youtubeConfigSchema.parse({});

export function isYoutubeConfigured(config: YoutubeConfig): boolean {
  return config.channels.length > 0;
}

export const youtubeSourceStatusSchema = z.enum(["ok", "empty", "error"]);
export type YoutubeSourceStatus = z.infer<typeof youtubeSourceStatusSchema>;

export const youtubeSourceResultSchema = z.object({
  id: z.string().uuid(),
  channelId: z.string(),
  label: z.string().min(1).max(80),
  status: youtubeSourceStatusSchema,
  message: z.string().max(240).optional(),
  itemCount: z.number().int().nonnegative(),
  cacheStatus: z.enum(["hit", "miss", "stale", "bypass"]).optional(),
});

export type YoutubeSourceResult = z.infer<typeof youtubeSourceResultSchema>;

export const youtubeItemSchema = z.object({
  id: z.string().min(1).max(200),
  title: z.string().min(1).max(240),
  url: z.string().url(),
  channelTitle: z.string().min(1).max(120),
  publishedAt: z.string().datetime({ offset: true }).nullable(),
  thumbnailUrl: z.string().url().nullable(),
  sourceId: z.string().uuid(),
  sourceLabel: z.string().min(1).max(80),
});

export type YoutubeItem = z.infer<typeof youtubeItemSchema>;

export const youtubeDataSchema = z.object({
  layout: youtubeLayoutSchema,
  showThumbnails: z.boolean(),
  openInNewTab: z.boolean(),
  items: z.array(youtubeItemSchema).max(100),
  sources: z.array(youtubeSourceResultSchema).max(10),
  fetchedAt: z.string().datetime({ offset: true }),
  failedSourceCount: z.number().int().nonnegative(),
});

export type YoutubeData = z.infer<typeof youtubeDataSchema>;

export function newYoutubeChannelId(): string {
  return newConfigEntryId();
}
