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
import { ClockRenderer, ClockSettings, clockDefinition } from "@dashora/widget-sdk/widgets/clock";
import {
  SearchRenderer,
  SearchSettings,
  searchDefinition,
} from "@dashora/widget-sdk/widgets/search";
import { TodoRenderer, TodoSettings, todoDefinition } from "@dashora/widget-sdk/widgets/todo";

export const demoMetricsMetadata: WidgetMetadata = toWidgetMetadata(demoMetricsDefinition);
export const searchMetadata: WidgetMetadata = toWidgetMetadata(searchDefinition);
export const clockMetadata: WidgetMetadata = toWidgetMetadata(clockDefinition);
export const bookmarksMetadata: WidgetMetadata = toWidgetMetadata(bookmarksDefinition);
export const todoMetadata: WidgetMetadata = toWidgetMetadata(todoDefinition);

export const widgetMetadataRegistry: WidgetMetadataRegistry = createWidgetMetadataRegistry([
  searchDefinition,
  clockDefinition,
  bookmarksDefinition,
  todoDefinition,
  demoMetricsDefinition,
]);

export const widgetClientRegistry: WidgetClientRegistry = createWidgetClientRegistry([
  toClientRegistration(searchDefinition, SearchRenderer, SearchSettings),
  toClientRegistration(clockDefinition, ClockRenderer, ClockSettings),
  toClientRegistration(bookmarksDefinition, BookmarksRenderer, BookmarksSettings),
  toClientRegistration(todoDefinition, TodoRenderer, TodoSettings),
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
