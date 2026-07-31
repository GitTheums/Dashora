import {
  type AnyWidgetDefinition,
  type WidgetMetadata,
  type WidgetMetadataRegistry,
  createWidgetMetadataRegistry,
  toWidgetMetadata,
} from "@dashora/widget-sdk";
import { bookmarksDefinition } from "@dashora/widget-sdk/widgets/bookmarks";
import { calendarDefinition } from "@dashora/widget-sdk/widgets/calendar";
import { clockDefinition } from "@dashora/widget-sdk/widgets/clock";
import { customApiDefinition } from "@dashora/widget-sdk/widgets/custom-api";
import { githubReleasesDefinition } from "@dashora/widget-sdk/widgets/github-releases";
import { githubRepositoryDefinition } from "@dashora/widget-sdk/widgets/github-repository";
import { hackerNewsDefinition } from "@dashora/widget-sdk/widgets/hacker-news";
import { iframeDefinition } from "@dashora/widget-sdk/widgets/iframe";
import { lobstersDefinition } from "@dashora/widget-sdk/widgets/lobsters";
import { marketsDefinition } from "@dashora/widget-sdk/widgets/markets";
import { redditDefinition } from "@dashora/widget-sdk/widgets/reddit";
import { rssDefinition } from "@dashora/widget-sdk/widgets/rss";
import { searchDefinition } from "@dashora/widget-sdk/widgets/search";
import { todoDefinition } from "@dashora/widget-sdk/widgets/todo";
import { twitchDefinition } from "@dashora/widget-sdk/widgets/twitch";
import { weatherDefinition } from "@dashora/widget-sdk/widgets/weather";
import { youtubeDefinition } from "@dashora/widget-sdk/widgets/youtube";
import { type ComponentType, lazy } from "react";

const widgetDefinitions: readonly AnyWidgetDefinition[] = [
  searchDefinition,
  clockDefinition,
  bookmarksDefinition,
  todoDefinition,
  weatherDefinition,
  rssDefinition,
  calendarDefinition,
  githubRepositoryDefinition,
  githubReleasesDefinition,
  marketsDefinition,
  hackerNewsDefinition,
  lobstersDefinition,
  redditDefinition,
  youtubeDefinition,
  twitchDefinition,
  customApiDefinition,
  iframeDefinition,
];

const definitionById = new Map(
  widgetDefinitions.map((definition) => [definition.id, definition] as const),
);

export const searchMetadata: WidgetMetadata = toWidgetMetadata(searchDefinition);
export const clockMetadata: WidgetMetadata = toWidgetMetadata(clockDefinition);
export const bookmarksMetadata: WidgetMetadata = toWidgetMetadata(bookmarksDefinition);
export const todoMetadata: WidgetMetadata = toWidgetMetadata(todoDefinition);
export const weatherMetadata: WidgetMetadata = toWidgetMetadata(weatherDefinition);
export const rssMetadata: WidgetMetadata = toWidgetMetadata(rssDefinition);
export const calendarMetadata: WidgetMetadata = toWidgetMetadata(calendarDefinition);
export const githubRepositoryMetadata: WidgetMetadata = toWidgetMetadata(
  githubRepositoryDefinition,
);
export const githubReleasesMetadata: WidgetMetadata = toWidgetMetadata(githubReleasesDefinition);
export const marketsMetadata: WidgetMetadata = toWidgetMetadata(marketsDefinition);
export const hackerNewsMetadata: WidgetMetadata = toWidgetMetadata(hackerNewsDefinition);
export const lobstersMetadata: WidgetMetadata = toWidgetMetadata(lobstersDefinition);
export const redditMetadata: WidgetMetadata = toWidgetMetadata(redditDefinition);
export const youtubeMetadata: WidgetMetadata = toWidgetMetadata(youtubeDefinition);
export const twitchMetadata: WidgetMetadata = toWidgetMetadata(twitchDefinition);
export const customApiMetadata: WidgetMetadata = toWidgetMetadata(customApiDefinition);
export const iframeMetadata: WidgetMetadata = toWidgetMetadata(iframeDefinition);

export const widgetMetadataRegistry: WidgetMetadataRegistry =
  createWidgetMetadataRegistry(widgetDefinitions);

type LazyUiModule = {
  default: ComponentType<Record<string, unknown>>;
};

type WidgetUiLoader = {
  loadRenderer: () => Promise<LazyUiModule>;
  loadSettings: () => Promise<LazyUiModule>;
};

function asUiComponent(component: unknown): ComponentType<Record<string, unknown>> {
  return component as ComponentType<Record<string, unknown>>;
}

const widgetUiLoaders: Record<string, WidgetUiLoader> = {
  search: {
    loadRenderer: () =>
      import("@dashora/widget-sdk/widgets/search").then((m) => ({
        default: asUiComponent(m.SearchRenderer),
      })),
    loadSettings: () =>
      import("@dashora/widget-sdk/widgets/search").then((m) => ({
        default: asUiComponent(m.SearchSettings),
      })),
  },
  clock: {
    loadRenderer: () =>
      import("@dashora/widget-sdk/widgets/clock").then((m) => ({
        default: asUiComponent(m.ClockRenderer),
      })),
    loadSettings: () =>
      import("@dashora/widget-sdk/widgets/clock").then((m) => ({
        default: asUiComponent(m.ClockSettings),
      })),
  },
  bookmarks: {
    loadRenderer: () =>
      import("@dashora/widget-sdk/widgets/bookmarks").then((m) => ({
        default: asUiComponent(m.BookmarksRenderer),
      })),
    loadSettings: () =>
      import("@dashora/widget-sdk/widgets/bookmarks").then((m) => ({
        default: asUiComponent(m.BookmarksSettings),
      })),
  },
  todo: {
    loadRenderer: () =>
      import("@dashora/widget-sdk/widgets/todo").then((m) => ({
        default: asUiComponent(m.TodoRenderer),
      })),
    loadSettings: () =>
      import("@dashora/widget-sdk/widgets/todo").then((m) => ({
        default: asUiComponent(m.TodoSettings),
      })),
  },
  weather: {
    loadRenderer: () =>
      import("@dashora/widget-sdk/widgets/weather").then((m) => ({
        default: asUiComponent(m.WeatherRenderer),
      })),
    loadSettings: () =>
      import("@dashora/widget-sdk/widgets/weather").then((m) => ({
        default: asUiComponent(m.WeatherSettings),
      })),
  },
  rss: {
    loadRenderer: () =>
      import("@dashora/widget-sdk/widgets/rss").then((m) => ({
        default: asUiComponent(m.RssRenderer),
      })),
    loadSettings: () =>
      import("@dashora/widget-sdk/widgets/rss").then((m) => ({
        default: asUiComponent(m.RssSettings),
      })),
  },
  calendar: {
    loadRenderer: () =>
      import("@dashora/widget-sdk/widgets/calendar").then((m) => ({
        default: asUiComponent(m.CalendarRenderer),
      })),
    loadSettings: () =>
      import("@dashora/widget-sdk/widgets/calendar").then((m) => ({
        default: asUiComponent(m.CalendarSettings),
      })),
  },
  "github-repository": {
    loadRenderer: () =>
      import("@dashora/widget-sdk/widgets/github-repository").then((m) => ({
        default: asUiComponent(m.GithubRepositoryRenderer),
      })),
    loadSettings: () =>
      import("@dashora/widget-sdk/widgets/github-repository").then((m) => ({
        default: asUiComponent(m.GithubRepositorySettings),
      })),
  },
  "github-releases": {
    loadRenderer: () =>
      import("@dashora/widget-sdk/widgets/github-releases").then((m) => ({
        default: asUiComponent(m.GithubReleasesRenderer),
      })),
    loadSettings: () =>
      import("@dashora/widget-sdk/widgets/github-releases").then((m) => ({
        default: asUiComponent(m.GithubReleasesSettings),
      })),
  },
  markets: {
    loadRenderer: () =>
      import("@dashora/widget-sdk/widgets/markets").then((m) => ({
        default: asUiComponent(m.MarketsRenderer),
      })),
    loadSettings: () =>
      import("@dashora/widget-sdk/widgets/markets").then((m) => ({
        default: asUiComponent(m.MarketsSettings),
      })),
  },
  "hacker-news": {
    loadRenderer: () =>
      import("@dashora/widget-sdk/widgets/hacker-news").then((m) => ({
        default: asUiComponent(m.HackerNewsRenderer),
      })),
    loadSettings: () =>
      import("@dashora/widget-sdk/widgets/hacker-news").then((m) => ({
        default: asUiComponent(m.HackerNewsSettings),
      })),
  },
  lobsters: {
    loadRenderer: () =>
      import("@dashora/widget-sdk/widgets/lobsters").then((m) => ({
        default: asUiComponent(m.LobstersRenderer),
      })),
    loadSettings: () =>
      import("@dashora/widget-sdk/widgets/lobsters").then((m) => ({
        default: asUiComponent(m.LobstersSettings),
      })),
  },
  reddit: {
    loadRenderer: () =>
      import("@dashora/widget-sdk/widgets/reddit").then((m) => ({
        default: asUiComponent(m.RedditRenderer),
      })),
    loadSettings: () =>
      import("@dashora/widget-sdk/widgets/reddit").then((m) => ({
        default: asUiComponent(m.RedditSettings),
      })),
  },
  youtube: {
    loadRenderer: () =>
      import("@dashora/widget-sdk/widgets/youtube").then((m) => ({
        default: asUiComponent(m.YoutubeRenderer),
      })),
    loadSettings: () =>
      import("@dashora/widget-sdk/widgets/youtube").then((m) => ({
        default: asUiComponent(m.YoutubeSettings),
      })),
  },
  twitch: {
    loadRenderer: () =>
      import("@dashora/widget-sdk/widgets/twitch").then((m) => ({
        default: asUiComponent(m.TwitchRenderer),
      })),
    loadSettings: () =>
      import("@dashora/widget-sdk/widgets/twitch").then((m) => ({
        default: asUiComponent(m.TwitchSettings),
      })),
  },
  "custom-api": {
    loadRenderer: () =>
      import("@dashora/widget-sdk/widgets/custom-api").then((m) => ({
        default: asUiComponent(m.CustomApiRenderer),
      })),
    loadSettings: () =>
      import("@dashora/widget-sdk/widgets/custom-api").then((m) => ({
        default: asUiComponent(m.CustomApiSettings),
      })),
  },
  iframe: {
    loadRenderer: () =>
      import("@dashora/widget-sdk/widgets/iframe").then((m) => ({
        default: asUiComponent(m.IframeRenderer),
      })),
    loadSettings: () =>
      import("@dashora/widget-sdk/widgets/iframe").then((m) => ({
        default: asUiComponent(m.IframeSettings),
      })),
  },
};

const lazyRenderers = new Map<string, ComponentType<Record<string, unknown>>>();
const lazySettings = new Map<string, ComponentType<Record<string, unknown>>>();

for (const [type, loader] of Object.entries(widgetUiLoaders)) {
  lazyRenderers.set(type, lazy(loader.loadRenderer));
  lazySettings.set(type, lazy(loader.loadSettings));
}

export function getWidgetDefinition(type: string): AnyWidgetDefinition | undefined {
  return definitionById.get(type);
}

export function getWidgetRenderer(type: string) {
  return lazyRenderers.get(type);
}

export function getWidgetSettings(type: string) {
  return lazySettings.get(type);
}

export function hasWidgetUi(type: string): boolean {
  return lazyRenderers.has(type);
}
