import { z } from "zod";
import { newConfigEntryId } from "../_shared/ids.js";

export const twitchLayoutSchema = z.enum(["compact", "rich"]);
export type TwitchLayout = z.infer<typeof twitchLayoutSchema>;

const twitchLoginSchema = z
  .string()
  .trim()
  .regex(/^[a-zA-Z0-9_]{1,25}$/, "Login must be 1–25 letters, numbers, or underscores")
  .transform((value) => value.toLowerCase());

export const twitchChannelConfigSchema = z.object({
  id: z.string().uuid(),
  login: twitchLoginSchema,
  label: z.string().trim().max(80).optional(),
});

export type TwitchChannelConfig = z.infer<typeof twitchChannelConfigSchema>;

export const twitchConfigSchema = z.object({
  channels: z.array(twitchChannelConfigSchema).max(20).default([]),
  layout: twitchLayoutSchema.default("rich"),
  showThumbnails: z.boolean().default(true),
  showOfflineChannels: z.boolean().default(true),
  openInNewTab: z.boolean().default(true),
  enabled: z.boolean().default(true),
});

export type TwitchConfig = z.infer<typeof twitchConfigSchema>;

export const TWITCH_DEFAULT_CONFIG: TwitchConfig = twitchConfigSchema.parse({});

export function isTwitchConfigured(config: TwitchConfig): boolean {
  return config.channels.length > 0;
}

export const twitchItemSchema = z.object({
  id: z.string().min(1).max(64),
  login: z.string().min(1).max(25),
  displayName: z.string().min(1).max(80),
  title: z.string().max(240).nullable(),
  gameName: z.string().max(120).nullable(),
  viewerCount: z.number().int().nonnegative(),
  startedAt: z.string().datetime({ offset: true }).nullable(),
  url: z.string().url(),
  thumbnailUrl: z.string().url().nullable(),
  isLive: z.boolean(),
  sourceId: z.string().uuid(),
});

export type TwitchItem = z.infer<typeof twitchItemSchema>;

export const twitchDataSchema = z.object({
  layout: twitchLayoutSchema,
  showThumbnails: z.boolean(),
  showOfflineChannels: z.boolean(),
  openInNewTab: z.boolean(),
  items: z.array(twitchItemSchema).max(20),
  fetchedAt: z.string().datetime({ offset: true }),
});

export type TwitchData = z.infer<typeof twitchDataSchema>;

export function newTwitchChannelId(): string {
  return newConfigEntryId();
}
