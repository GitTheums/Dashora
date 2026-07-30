import {
  type WidgetClientRegistry,
  type WidgetMetadata,
  type WidgetMetadataRegistry,
  createWidgetClientRegistry,
  createWidgetMetadataRegistry,
  toClientRegistration,
  toWidgetMetadata,
} from "@dashora/widget-sdk";
import {
  DemoMetricsRenderer,
  DemoMetricsSettings,
  demoMetricsDefinition,
} from "@dashora/widget-sdk/examples/demo-metrics";
import {
  BookmarksRenderer,
  BookmarksSettings,
  bookmarksDefinition,
} from "@dashora/widget-sdk/widgets/bookmarks";
import {
  CalendarRenderer,
  CalendarSettings,
  calendarDefinition,
} from "@dashora/widget-sdk/widgets/calendar";
import { ClockRenderer, ClockSettings, clockDefinition } from "@dashora/widget-sdk/widgets/clock";
import {
  GithubReleasesRenderer,
  GithubReleasesSettings,
  githubReleasesDefinition,
} from "@dashora/widget-sdk/widgets/github-releases";
import {
  GithubRepositoryRenderer,
  GithubRepositorySettings,
  githubRepositoryDefinition,
} from "@dashora/widget-sdk/widgets/github-repository";
import {
  MarketsRenderer,
  MarketsSettings,
  marketsDefinition,
} from "@dashora/widget-sdk/widgets/markets";
import { RssRenderer, RssSettings, rssDefinition } from "@dashora/widget-sdk/widgets/rss";
import {
  SearchRenderer,
  SearchSettings,
  searchDefinition,
} from "@dashora/widget-sdk/widgets/search";
import { TodoRenderer, TodoSettings, todoDefinition } from "@dashora/widget-sdk/widgets/todo";
import {
  WeatherRenderer,
  WeatherSettings,
  weatherDefinition,
} from "@dashora/widget-sdk/widgets/weather";

export const demoMetricsMetadata: WidgetMetadata = toWidgetMetadata(demoMetricsDefinition);
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

export const widgetMetadataRegistry: WidgetMetadataRegistry = createWidgetMetadataRegistry([
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
  demoMetricsDefinition,
]);

export const widgetClientRegistry: WidgetClientRegistry = createWidgetClientRegistry([
  toClientRegistration(searchDefinition, SearchRenderer, SearchSettings),
  toClientRegistration(clockDefinition, ClockRenderer, ClockSettings),
  toClientRegistration(bookmarksDefinition, BookmarksRenderer, BookmarksSettings),
  toClientRegistration(todoDefinition, TodoRenderer, TodoSettings),
  toClientRegistration(weatherDefinition, WeatherRenderer, WeatherSettings),
  toClientRegistration(rssDefinition, RssRenderer, RssSettings),
  toClientRegistration(calendarDefinition, CalendarRenderer, CalendarSettings),
  toClientRegistration(
    githubRepositoryDefinition,
    GithubRepositoryRenderer,
    GithubRepositorySettings,
  ),
  toClientRegistration(githubReleasesDefinition, GithubReleasesRenderer, GithubReleasesSettings),
  toClientRegistration(marketsDefinition, MarketsRenderer, MarketsSettings),
  toClientRegistration(demoMetricsDefinition, DemoMetricsRenderer, DemoMetricsSettings),
]);

export function getWidgetDefinition(type: string) {
  return widgetClientRegistry.getDefinition(type);
}

export function getWidgetRenderer(type: string) {
  return widgetClientRegistry.getRenderer(type);
}

export function getWidgetSettings(type: string) {
  return widgetClientRegistry.getSettings(type);
}
