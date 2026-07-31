import type { WidgetState } from "@dashora/widget-sdk";
import {
  BOOKMARKS_WIDGET_ID,
  bookmarksConfigSchema,
  resolveBookmarksData,
} from "@dashora/widget-sdk/widgets/bookmarks";
import {
  CALENDAR_WIDGET_ID,
  calendarConfigSchema,
  createCalendarClient,
} from "@dashora/widget-sdk/widgets/calendar";
import {
  CLOCK_WIDGET_ID,
  buildClockData,
  clockConfigSchema,
} from "@dashora/widget-sdk/widgets/clock";
import {
  CUSTOM_API_WIDGET_ID,
  createCustomApiClient,
  customApiConfigSchema,
} from "@dashora/widget-sdk/widgets/custom-api";
import {
  GITHUB_RELEASES_WIDGET_ID,
  createGithubReleasesClient,
  githubReleasesConfigSchema,
} from "@dashora/widget-sdk/widgets/github-releases";
import {
  GITHUB_REPOSITORY_WIDGET_ID,
  createGithubRepositoryClient,
  githubRepositoryConfigSchema,
  isGithubRepositoryConfigured,
} from "@dashora/widget-sdk/widgets/github-repository";
import {
  HACKER_NEWS_WIDGET_ID,
  createHackerNewsClient,
  hackerNewsConfigSchema,
} from "@dashora/widget-sdk/widgets/hacker-news";
import {
  IFRAME_WIDGET_ID,
  createIframeClient,
  iframeConfigSchema,
} from "@dashora/widget-sdk/widgets/iframe";
import {
  LOBSTERS_WIDGET_ID,
  createLobstersClient,
  lobstersConfigSchema,
} from "@dashora/widget-sdk/widgets/lobsters";
import {
  MARKETS_WIDGET_ID,
  createMarketsClient,
  isMarketsConfigured,
  marketsConfigSchema,
} from "@dashora/widget-sdk/widgets/markets";
import {
  REDDIT_WIDGET_ID,
  createRedditClient,
  isRedditConfigured,
  redditConfigSchema,
} from "@dashora/widget-sdk/widgets/reddit";
import { RSS_WIDGET_ID, createRssClient, rssConfigSchema } from "@dashora/widget-sdk/widgets/rss";
import {
  SEARCH_WIDGET_ID,
  resolveSearchData,
  searchConfigSchema,
} from "@dashora/widget-sdk/widgets/search";
import {
  TODO_WIDGET_ID,
  createTodoClient,
  filterVisibleTodoItems,
  todoConfigSchema,
} from "@dashora/widget-sdk/widgets/todo";
import {
  TWITCH_WIDGET_ID,
  createTwitchClient,
  isTwitchConfigured,
  twitchConfigSchema,
} from "@dashora/widget-sdk/widgets/twitch";
import {
  WEATHER_WIDGET_ID,
  createWeatherClient,
  weatherConfigSchema,
} from "@dashora/widget-sdk/widgets/weather";
import {
  YOUTUBE_WIDGET_ID,
  createYoutubeClient,
  isYoutubeConfigured,
  youtubeConfigSchema,
} from "@dashora/widget-sdk/widgets/youtube";

export type ResolvedWidgetPayload = {
  state: WidgetState;
  data?: unknown;
  message?: string;
};

export type ResolveWidgetPayloadOptions = {
  forceRefresh?: boolean;
  signal?: AbortSignal;
};

const todoClient = createTodoClient();
const weatherClient = createWeatherClient();
const rssClient = createRssClient();
const calendarClient = createCalendarClient();
const githubRepositoryClient = createGithubRepositoryClient();
const githubReleasesClient = createGithubReleasesClient();
const marketsClient = createMarketsClient();
const hackerNewsClient = createHackerNewsClient();
const lobstersClient = createLobstersClient();
const redditClient = createRedditClient();
const youtubeClient = createYoutubeClient();
const twitchClient = createTwitchClient();
const customApiClient = createCustomApiClient();
const iframeClient = createIframeClient();

function fetchOptions(options?: ResolveWidgetPayloadOptions) {
  return {
    ...(options?.forceRefresh ? { forceRefresh: true } : {}),
    ...(options?.signal ? { signal: options.signal } : {}),
  };
}

function payload(
  state: WidgetState,
  options: { data?: unknown; message?: string } = {},
): ResolvedWidgetPayload {
  return {
    state,
    ...(options.data !== undefined ? { data: options.data } : {}),
    ...(options.message !== undefined ? { message: options.message } : {}),
  };
}

function disabledPayload(message: string): ResolvedWidgetPayload {
  return payload("disabled", { message });
}

/**
 * Resolves display data for registered widgets on the client.
 * Config-backed widgets derive payloads locally; remote widgets load from the API.
 */
export async function resolveTypedWidgetPayload(
  type: string,
  instanceId: string,
  rawConfig: unknown,
  enabled: boolean,
  options?: ResolveWidgetPayloadOptions,
): Promise<ResolvedWidgetPayload> {
  if (!enabled) {
    return disabledPayload("Widget disabled");
  }

  const remoteOptions = fetchOptions(options);

  switch (type) {
    case SEARCH_WIDGET_ID: {
      const config = searchConfigSchema.parse(rawConfig);
      if (!config.enabled) {
        return disabledPayload("Search is disabled in settings.");
      }
      const data = resolveSearchData(config);
      if (!data) {
        return payload("configuration-required", {
          message: "Choose a search engine or provide a safe custom template with {query}.",
        });
      }
      return payload("success", { data });
    }
    case CLOCK_WIDGET_ID: {
      const config = clockConfigSchema.parse(rawConfig);
      if (!config.enabled) {
        return disabledPayload("Clock is disabled in settings.");
      }
      return payload("success", { data: buildClockData(config) });
    }
    case BOOKMARKS_WIDGET_ID: {
      const config = bookmarksConfigSchema.parse(rawConfig);
      if (!config.enabled) {
        return disabledPayload("Bookmarks is disabled in settings.");
      }
      const data = resolveBookmarksData(config);
      if (data.totalItems === 0) {
        return payload("empty", {
          data,
          message: "Add bookmark groups and links in settings.",
        });
      }
      return payload("success", { data });
    }
    case TODO_WIDGET_ID: {
      const config = todoConfigSchema.parse(rawConfig);
      if (!config.enabled) {
        return disabledPayload("Todo is disabled in settings.");
      }
      try {
        const items = await todoClient.list(instanceId);
        const visible = filterVisibleTodoItems(items, config.showCompleted);
        const data = {
          items: visible,
          viewMode: config.viewMode,
          showCompleted: config.showCompleted,
        };
        if (visible.length === 0) {
          return payload("empty", {
            data,
            message: config.showCompleted
              ? "Your completed and upcoming tasks will appear here."
              : "No open tasks. Turn on completed tasks in settings to review finished work.",
          });
        }
        return payload("success", { data });
      } catch (error) {
        return payload("error", {
          message: error instanceof Error ? error.message : "Could not load tasks.",
        });
      }
    }
    case WEATHER_WIDGET_ID: {
      const config = weatherConfigSchema.parse(rawConfig);
      if (!config.enabled) {
        return disabledPayload("Weather is disabled in settings.");
      }
      if (!config.location) {
        return payload("configuration-required", {
          message: "Search for a location in settings to show the forecast.",
        });
      }
      try {
        const envelope = await weatherClient.fetchData(instanceId, config, remoteOptions);
        return payload(envelope.state, {
          ...(envelope.data !== undefined ? { data: envelope.data } : {}),
          ...(envelope.message !== undefined ? { message: envelope.message } : {}),
        });
      } catch (error) {
        return payload("error", {
          message: error instanceof Error ? error.message : "Could not load the weather forecast.",
        });
      }
    }
    case RSS_WIDGET_ID: {
      const config = rssConfigSchema.parse(rawConfig);
      if (!config.enabled) {
        return disabledPayload("RSS is disabled in settings.");
      }
      if (config.feeds.length === 0) {
        return payload("configuration-required", {
          message: "Add at least one feed URL in settings.",
        });
      }
      try {
        const envelope = await rssClient.fetchData(instanceId, config, remoteOptions);
        return payload(envelope.state, {
          ...(envelope.data !== undefined ? { data: envelope.data } : {}),
          ...(envelope.message !== undefined ? { message: envelope.message } : {}),
        });
      } catch (error) {
        return payload("error", {
          message: error instanceof Error ? error.message : "Could not load feeds.",
        });
      }
    }
    case CALENDAR_WIDGET_ID: {
      const config = calendarConfigSchema.parse(rawConfig);
      if (!config.enabled) {
        return disabledPayload("Calendar is disabled in settings.");
      }
      if (config.feeds.length === 0) {
        return payload("configuration-required", {
          message: "Add at least one ICS feed URL in settings.",
        });
      }
      try {
        const envelope = await calendarClient.fetchData(instanceId, config, remoteOptions);
        return payload(envelope.state, {
          ...(envelope.data !== undefined ? { data: envelope.data } : {}),
          ...(envelope.message !== undefined ? { message: envelope.message } : {}),
        });
      } catch (error) {
        return payload("error", {
          message: error instanceof Error ? error.message : "Could not load calendar feeds.",
        });
      }
    }
    case GITHUB_REPOSITORY_WIDGET_ID: {
      const config = githubRepositoryConfigSchema.parse(rawConfig);
      if (!config.enabled) {
        return disabledPayload("GitHub Repository is disabled in settings.");
      }
      if (!isGithubRepositoryConfigured(config)) {
        return payload("configuration-required", {
          message: "Set the repository owner and name in settings.",
        });
      }
      try {
        const envelope = await githubRepositoryClient.fetchData(instanceId, config, remoteOptions);
        return payload(envelope.state, {
          ...(envelope.data !== undefined ? { data: envelope.data } : {}),
          ...(envelope.message !== undefined ? { message: envelope.message } : {}),
        });
      } catch (error) {
        return payload("error", {
          message: error instanceof Error ? error.message : "Could not load the GitHub repository.",
        });
      }
    }
    case GITHUB_RELEASES_WIDGET_ID: {
      const config = githubReleasesConfigSchema.parse(rawConfig);
      if (!config.enabled) {
        return disabledPayload("GitHub Releases is disabled in settings.");
      }
      if (config.repositories.length === 0) {
        return payload("configuration-required", {
          message: "Add at least one repository in settings.",
        });
      }
      try {
        const envelope = await githubReleasesClient.fetchData(instanceId, config, remoteOptions);
        return payload(envelope.state, {
          ...(envelope.data !== undefined ? { data: envelope.data } : {}),
          ...(envelope.message !== undefined ? { message: envelope.message } : {}),
        });
      } catch (error) {
        return payload("error", {
          message: error instanceof Error ? error.message : "Could not load GitHub releases.",
        });
      }
    }
    case MARKETS_WIDGET_ID: {
      const config = marketsConfigSchema.parse(rawConfig);
      if (!config.enabled) {
        return disabledPayload("Markets is disabled in settings.");
      }
      if (!isMarketsConfigured(config)) {
        return payload("configuration-required", {
          message: "Add at least one symbol in settings to build a watchlist.",
        });
      }
      try {
        const envelope = await marketsClient.fetchData(instanceId, config, remoteOptions);
        return payload(envelope.state, {
          ...(envelope.data !== undefined ? { data: envelope.data } : {}),
          ...(envelope.message !== undefined ? { message: envelope.message } : {}),
        });
      } catch (error) {
        return payload("error", {
          message: error instanceof Error ? error.message : "Could not load market quotes.",
        });
      }
    }
    case HACKER_NEWS_WIDGET_ID: {
      const config = hackerNewsConfigSchema.parse(rawConfig);
      if (!config.enabled) {
        return disabledPayload("Hacker News is disabled in settings.");
      }
      try {
        const envelope = await hackerNewsClient.fetchData(instanceId, config, remoteOptions);
        return payload(envelope.state, {
          ...(envelope.data !== undefined ? { data: envelope.data } : {}),
          ...(envelope.message !== undefined ? { message: envelope.message } : {}),
        });
      } catch (error) {
        return payload("error", {
          message: error instanceof Error ? error.message : "Could not load Hacker News stories.",
        });
      }
    }
    case LOBSTERS_WIDGET_ID: {
      const config = lobstersConfigSchema.parse(rawConfig);
      if (!config.enabled) {
        return disabledPayload("Lobsters is disabled in settings.");
      }
      if (config.sources.length === 0) {
        return payload("configuration-required", {
          message: "Add at least one Lobsters source in settings.",
        });
      }
      try {
        const envelope = await lobstersClient.fetchData(instanceId, config, remoteOptions);
        return payload(envelope.state, {
          ...(envelope.data !== undefined ? { data: envelope.data } : {}),
          ...(envelope.message !== undefined ? { message: envelope.message } : {}),
        });
      } catch (error) {
        return payload("error", {
          message: error instanceof Error ? error.message : "Could not load Lobsters stories.",
        });
      }
    }
    case REDDIT_WIDGET_ID: {
      const config = redditConfigSchema.parse(rawConfig);
      if (!config.enabled) {
        return disabledPayload("Reddit is disabled in settings.");
      }
      if (!isRedditConfigured(config)) {
        return payload("configuration-required", {
          message: "Add at least one subreddit in settings.",
        });
      }
      try {
        const envelope = await redditClient.fetchData(instanceId, config, remoteOptions);
        return payload(envelope.state, {
          ...(envelope.data !== undefined ? { data: envelope.data } : {}),
          ...(envelope.message !== undefined ? { message: envelope.message } : {}),
        });
      } catch (error) {
        return payload("error", {
          message: error instanceof Error ? error.message : "Could not load Reddit posts.",
        });
      }
    }
    case YOUTUBE_WIDGET_ID: {
      const config = youtubeConfigSchema.parse(rawConfig);
      if (!config.enabled) {
        return disabledPayload("YouTube is disabled in settings.");
      }
      if (!isYoutubeConfigured(config)) {
        return payload("configuration-required", {
          message: "Add at least one YouTube channel id in settings.",
        });
      }
      try {
        const envelope = await youtubeClient.fetchData(instanceId, config, remoteOptions);
        return payload(envelope.state, {
          ...(envelope.data !== undefined ? { data: envelope.data } : {}),
          ...(envelope.message !== undefined ? { message: envelope.message } : {}),
        });
      } catch (error) {
        return payload("error", {
          message: error instanceof Error ? error.message : "Could not load YouTube uploads.",
        });
      }
    }
    case TWITCH_WIDGET_ID: {
      const config = twitchConfigSchema.parse(rawConfig);
      if (!config.enabled) {
        return disabledPayload("Twitch is disabled in settings.");
      }
      if (!isTwitchConfigured(config)) {
        return payload("configuration-required", {
          message: "Add at least one Twitch channel login in settings.",
        });
      }
      try {
        const envelope = await twitchClient.fetchData(instanceId, config, remoteOptions);
        return payload(envelope.state, {
          ...(envelope.data !== undefined ? { data: envelope.data } : {}),
          ...(envelope.message !== undefined ? { message: envelope.message } : {}),
        });
      } catch (error) {
        return payload("error", {
          message: error instanceof Error ? error.message : "Could not load Twitch channels.",
        });
      }
    }
    case CUSTOM_API_WIDGET_ID: {
      const config = customApiConfigSchema.parse(rawConfig);
      if (!config.enabled) {
        return disabledPayload("Custom API is disabled in settings.");
      }
      if (!config.url.trim()) {
        return payload("configuration-required", {
          message: "Set a request URL in settings.",
        });
      }
      try {
        const envelope = await customApiClient.fetchData(instanceId, config, remoteOptions);
        return payload(envelope.state, {
          ...(envelope.data !== undefined ? { data: envelope.data } : {}),
          ...(envelope.message !== undefined ? { message: envelope.message } : {}),
        });
      } catch (error) {
        return payload("error", {
          message: error instanceof Error ? error.message : "Could not load Custom API data.",
        });
      }
    }
    case IFRAME_WIDGET_ID: {
      const config = iframeConfigSchema.parse(rawConfig);
      if (!config.enabled) {
        return disabledPayload("iFrame is disabled in settings.");
      }
      if (!config.url.trim()) {
        return payload("configuration-required", {
          message: "Set an embed URL in settings.",
        });
      }
      try {
        const envelope = await iframeClient.fetchData(instanceId, config, remoteOptions);
        return payload(envelope.state, {
          ...(envelope.data !== undefined ? { data: envelope.data } : {}),
          ...(envelope.message !== undefined ? { message: envelope.message } : {}),
        });
      } catch (error) {
        return payload("error", {
          message: error instanceof Error ? error.message : "Could not load the iframe preview.",
        });
      }
    }
    default:
      return payload("error", {
        message: `No data adapter is registered for “${type}”.`,
      });
  }
}
