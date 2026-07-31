import { defineWidgetProvider } from "../../provider.js";
import { feedAdapterErrorToWidget } from "../_shared/feed-errors.js";
import { parseFeedDate, sanitizeHttpUrl, stripHtmlToText } from "../rss/sanitize.js";
import type { TwitchAdapter, TwitchChannelPayload, TwitchCredentials } from "./adapter.js";
import {
  type TwitchConfig,
  type TwitchData,
  type TwitchItem,
  isTwitchConfigured,
  twitchConfigSchema,
  twitchDataSchema,
} from "./config.js";
import { TWITCH_WIDGET_ID } from "./definition.js";

export type TwitchProviderDeps = {
  adapter: TwitchAdapter;
  resolveCredentials?: () => TwitchCredentials | null;
};

function sanitizeChannel(
  raw: TwitchChannelPayload,
  sourceId: string,
  showThumbnails: boolean,
): TwitchItem | null {
  const login = stripHtmlToText(raw.login, 25)?.toLowerCase();
  if (!login) {
    return null;
  }
  const displayName = stripHtmlToText(raw.displayName, 80) || login;
  const url = sanitizeHttpUrl(raw.url) ?? `https://www.twitch.tv/${login}`;
  return {
    id: raw.id.slice(0, 64),
    login,
    displayName,
    title: raw.title ? stripHtmlToText(raw.title, 240) || null : null,
    gameName: raw.gameName ? stripHtmlToText(raw.gameName, 120) || null : null,
    viewerCount: Math.max(0, Math.floor(raw.viewerCount)),
    startedAt: parseFeedDate(raw.startedAt),
    url,
    thumbnailUrl: showThumbnails ? sanitizeHttpUrl(raw.thumbnailUrl) : null,
    isLive: raw.isLive,
    sourceId,
  };
}

export function createTwitchProvider(deps: TwitchProviderDeps) {
  return defineWidgetProvider<TwitchConfig, TwitchData>({
    id: TWITCH_WIDGET_ID,
    fetch: async (ctx) => {
      const config = twitchConfigSchema.parse(ctx.config);

      if (!config.enabled) {
        return { state: "disabled", message: "Twitch is disabled in settings." };
      }

      if (!isTwitchConfigured(config)) {
        return {
          state: "configuration-required",
          message: "Add at least one Twitch channel login in settings.",
        };
      }

      const credentials = deps.resolveCredentials?.() ?? null;
      if (!deps.adapter.isConfigured(credentials)) {
        return {
          state: "configuration-required",
          message:
            "Set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET on the server to load Twitch channels.",
        };
      }

      const now = ctx.now?.() ?? new Date();

      try {
        const logins = config.channels.map((channel) => channel.login);
        const result = await deps.adapter.fetchChannels({
          logins,
          credentials: credentials as TwitchCredentials,
          ...(ctx.signal ? { signal: ctx.signal } : {}),
          ...(ctx.forceRefresh !== undefined ? { forceRefresh: ctx.forceRefresh } : {}),
        });

        const loginToSourceId = new Map(
          config.channels.map((channel) => [channel.login.toLowerCase(), channel.id]),
        );

        let items: TwitchItem[] = [];
        for (const raw of result.channels) {
          const sourceId = loginToSourceId.get(raw.login.toLowerCase());
          if (!sourceId) {
            continue;
          }
          const item = sanitizeChannel(raw, sourceId, config.showThumbnails);
          if (item) {
            items.push(item);
          }
        }

        // Preserve config order.
        items = config.channels
          .map((channel) => items.find((item) => item.sourceId === channel.id))
          .filter((item): item is TwitchItem => Boolean(item));

        if (!config.showOfflineChannels) {
          items = items.filter((item) => item.isLive);
        }

        const data = twitchDataSchema.parse({
          layout: config.layout,
          showThumbnails: config.showThumbnails,
          showOfflineChannels: config.showOfflineChannels,
          openInNewTab: config.openInNewTab,
          items,
          fetchedAt: now.toISOString(),
        });

        if (items.length === 0) {
          return {
            state: "empty",
            data,
            message: config.showOfflineChannels
              ? "No channels were returned."
              : "No channels are live right now.",
            cacheStatus: result.cacheStatus,
          };
        }

        if (result.cacheStatus === "stale") {
          return {
            state: "stale",
            data,
            message: "Showing last good Twitch data while a refresh is due.",
            cacheStatus: "stale",
          };
        }

        if (ctx.forceRefresh) {
          return {
            state: "refreshing",
            data,
            message: "Refreshing Twitch channels…",
            cacheStatus: result.cacheStatus,
          };
        }

        return {
          state: "success",
          data,
          cacheStatus: result.cacheStatus,
        };
      } catch (error) {
        return feedAdapterErrorToWidget(
          error,
          "Could not load Twitch channels.",
          "twitch_fetch_failed",
        );
      }
    },
  });
}
