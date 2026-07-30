import type {
  PageWidget,
  PlaceholderTone,
  PlaceholderWidget,
  TypedWidgetInstance,
  WidgetPlacementSize,
} from "@dashora/shared";
import {
  type AnyWidgetDefinition,
  WIDGET_CATEGORIES,
  WIDGET_CATEGORY_LABELS,
  type WidgetCapabilities,
  type WidgetCategory,
  type WidgetMetadata,
} from "@dashora/widget-sdk";
import {
  DEMO_METRICS_DEFAULT_CONFIG,
  DEMO_METRICS_WIDGET_ID,
  demoMetricsDefinition,
} from "@dashora/widget-sdk/examples/demo-metrics";
import {
  BOOKMARKS_DEFAULT_CONFIG,
  BOOKMARKS_WIDGET_ID,
  bookmarksDefinition,
} from "@dashora/widget-sdk/widgets/bookmarks";
import {
  CALENDAR_DEFAULT_CONFIG,
  CALENDAR_WIDGET_ID,
  calendarDefinition,
} from "@dashora/widget-sdk/widgets/calendar";
import {
  CLOCK_DEFAULT_CONFIG,
  CLOCK_WIDGET_ID,
  clockDefinition,
} from "@dashora/widget-sdk/widgets/clock";
import {
  GITHUB_RELEASES_DEFAULT_CONFIG,
  GITHUB_RELEASES_WIDGET_ID,
  githubReleasesDefinition,
} from "@dashora/widget-sdk/widgets/github-releases";
import {
  GITHUB_REPOSITORY_DEFAULT_CONFIG,
  GITHUB_REPOSITORY_WIDGET_ID,
  githubRepositoryDefinition,
} from "@dashora/widget-sdk/widgets/github-repository";
import {
  MARKETS_DEFAULT_CONFIG,
  MARKETS_WIDGET_ID,
  marketsDefinition,
} from "@dashora/widget-sdk/widgets/markets";
import { RSS_DEFAULT_CONFIG, RSS_WIDGET_ID, rssDefinition } from "@dashora/widget-sdk/widgets/rss";
import {
  SEARCH_DEFAULT_CONFIG,
  SEARCH_WIDGET_ID,
  searchDefinition,
} from "@dashora/widget-sdk/widgets/search";
import {
  TODO_DEFAULT_CONFIG,
  TODO_WIDGET_ID,
  todoDefinition,
} from "@dashora/widget-sdk/widgets/todo";
import {
  WEATHER_DEFAULT_CONFIG,
  WEATHER_WIDGET_ID,
  weatherDefinition,
} from "@dashora/widget-sdk/widgets/weather";
import {
  bookmarksMetadata,
  calendarMetadata,
  clockMetadata,
  demoMetricsMetadata,
  githubReleasesMetadata,
  githubRepositoryMetadata,
  marketsMetadata,
  rssMetadata,
  searchMetadata,
  todoMetadata,
  weatherMetadata,
} from "../widgets/registry.js";

export type CatalogEntryKind = "widget" | "placeholder";

export type WidgetCatalogEntry = {
  /** Stable catalog id (widget type or placeholder catalog key). */
  id: string;
  kind: CatalogEntryKind;
  name: string;
  description: string;
  category: WidgetCategory;
  iconName: string;
  defaultLayout: WidgetPlacementSize;
  capabilities: WidgetCapabilities;
  /** When true, open settings immediately after adding. */
  requiresConfigurationOnAdd: boolean;
  previewLabel: string;
  /** Placeholder defaults when kind is placeholder. */
  placeholderDefaults?: {
    title: string;
    description: string;
    tone: PlaceholderTone;
  };
  /** Typed widget metadata when kind is widget. */
  metadata?: WidgetMetadata;
  defaultConfig?: Record<string, unknown>;
  schemaVersion?: number;
};

const PLACEHOLDER_CAPABILITIES: WidgetCapabilities = {
  supportsManualRefresh: true,
  supportsTitleOverride: true,
  requiresIntegration: false,
  supportsDisable: true,
  hasSettings: true,
};

const DEFAULT_PLACEHOLDER_LAYOUT: WidgetPlacementSize = {
  colSpan: 4,
  rowSpan: 2,
  minColSpan: 2,
  minRowSpan: 1,
  maxColSpan: 8,
  maxRowSpan: 4,
  tabletColSpan: 4,
  mobileColSpan: 4,
};

function placeholderEntry(
  id: string,
  name: string,
  description: string,
  category: WidgetCategory,
  tone: PlaceholderTone,
  options?: {
    requiresIntegration?: boolean;
    requiresConfigurationOnAdd?: boolean;
    layout?: Partial<WidgetPlacementSize>;
  },
): WidgetCatalogEntry {
  const requiresIntegration = options?.requiresIntegration ?? false;
  return {
    id: `placeholder:${id}`,
    kind: "placeholder",
    name,
    description,
    category,
    iconName: "grid",
    defaultLayout: { ...DEFAULT_PLACEHOLDER_LAYOUT, ...options?.layout },
    capabilities: {
      ...PLACEHOLDER_CAPABILITIES,
      requiresIntegration,
    },
    requiresConfigurationOnAdd: options?.requiresConfigurationOnAdd ?? requiresIntegration,
    previewLabel: `${name} placeholder`,
    placeholderDefaults: {
      title: name,
      description,
      tone,
    },
  };
}

function catalogFromDefinition(
  definition: AnyWidgetDefinition,
  metadata: WidgetMetadata,
  defaultConfig: Record<string, unknown>,
  previewLabel: string,
  requiresConfigurationOnAdd = false,
): WidgetCatalogEntry {
  return {
    id: definition.id,
    kind: "widget",
    name: metadata.name,
    description: metadata.description,
    category: metadata.category,
    iconName: metadata.icon.name,
    defaultLayout: {
      colSpan: definition.defaultLayout.colSpan,
      rowSpan: definition.defaultLayout.rowSpan,
      ...(definition.defaultLayout.minColSpan !== undefined
        ? { minColSpan: definition.defaultLayout.minColSpan }
        : {}),
      ...(definition.defaultLayout.minRowSpan !== undefined
        ? { minRowSpan: definition.defaultLayout.minRowSpan }
        : {}),
      ...(definition.defaultLayout.maxColSpan !== undefined
        ? { maxColSpan: definition.defaultLayout.maxColSpan }
        : {}),
      ...(definition.defaultLayout.maxRowSpan !== undefined
        ? { maxRowSpan: definition.defaultLayout.maxRowSpan }
        : {}),
      ...(definition.defaultLayout.tabletColSpan !== undefined
        ? { tabletColSpan: definition.defaultLayout.tabletColSpan }
        : {}),
      ...(definition.defaultLayout.mobileColSpan !== undefined
        ? { mobileColSpan: definition.defaultLayout.mobileColSpan }
        : {}),
    },
    capabilities: metadata.capabilities,
    requiresConfigurationOnAdd,
    previewLabel,
    metadata,
    defaultConfig: { ...defaultConfig },
    schemaVersion: definition.schemaVersion,
  };
}

const PLACEHOLDER_ENTRIES: WidgetCatalogEntry[] = [
  placeholderEntry("services", "Services", "Health checks placeholder", "network", "muted", {
    requiresIntegration: true,
    requiresConfigurationOnAdd: true,
  }),
  placeholderEntry("notes", "Notes", "Scratch pad placeholder", "productivity", "muted"),
  placeholderEntry("status", "Status", "System status placeholder", "network", "accent", {
    requiresIntegration: true,
    layout: { colSpan: 4, rowSpan: 1, minRowSpan: 1, maxRowSpan: 2 },
  }),
];

const PRODUCTION_ENTRIES: WidgetCatalogEntry[] = [
  catalogFromDefinition(
    searchDefinition,
    searchMetadata,
    SEARCH_DEFAULT_CONFIG,
    "Web search with shortcut",
  ),
  catalogFromDefinition(clockDefinition, clockMetadata, CLOCK_DEFAULT_CONFIG, "Timezone clock"),
  catalogFromDefinition(
    bookmarksDefinition,
    bookmarksMetadata,
    BOOKMARKS_DEFAULT_CONFIG,
    "Grouped bookmark links",
    true,
  ),
  catalogFromDefinition(todoDefinition, todoMetadata, TODO_DEFAULT_CONFIG, "Local task list"),
  catalogFromDefinition(
    weatherDefinition,
    weatherMetadata,
    WEATHER_DEFAULT_CONFIG,
    "Local conditions and forecasts",
    true,
  ),
  catalogFromDefinition(
    rssDefinition,
    rssMetadata,
    RSS_DEFAULT_CONFIG,
    "RSS and Atom headlines",
    true,
  ),
  catalogFromDefinition(
    calendarDefinition,
    calendarMetadata,
    CALENDAR_DEFAULT_CONFIG,
    "ICS calendar feeds",
    true,
  ),
  catalogFromDefinition(
    githubRepositoryDefinition,
    githubRepositoryMetadata,
    GITHUB_REPOSITORY_DEFAULT_CONFIG,
    "Repository stats and activity",
    true,
  ),
  catalogFromDefinition(
    githubReleasesDefinition,
    githubReleasesMetadata,
    GITHUB_RELEASES_DEFAULT_CONFIG,
    "Latest releases across repositories",
    true,
  ),
  catalogFromDefinition(
    marketsDefinition,
    marketsMetadata,
    MARKETS_DEFAULT_CONFIG,
    "Crypto, equities, and index watchlist",
    true,
  ),
];

const DEMO_ENTRY: WidgetCatalogEntry = catalogFromDefinition(
  demoMetricsDefinition,
  demoMetricsMetadata,
  DEMO_METRICS_DEFAULT_CONFIG,
  "Live demo metric value",
);

export const WIDGET_CATALOG: readonly WidgetCatalogEntry[] = [
  ...PRODUCTION_ENTRIES,
  DEMO_ENTRY,
  ...PLACEHOLDER_ENTRIES,
];

export const CATALOG_CATEGORY_FILTERS: Array<{ id: "all" | WidgetCategory; label: string }> = [
  { id: "all", label: "All" },
  ...WIDGET_CATEGORIES.filter((category) =>
    WIDGET_CATALOG.some((entry) => entry.category === category),
  ).map((category) => ({
    id: category,
    label: WIDGET_CATEGORY_LABELS[category],
  })),
];

export function getCatalogEntry(id: string): WidgetCatalogEntry | undefined {
  return WIDGET_CATALOG.find((entry) => entry.id === id);
}

export function filterCatalog(
  query: string,
  category: "all" | WidgetCategory,
): WidgetCatalogEntry[] {
  const normalized = query.trim().toLowerCase();
  return WIDGET_CATALOG.filter((entry) => {
    if (category !== "all" && entry.category !== category) {
      return false;
    }
    if (!normalized) {
      return true;
    }
    return (
      entry.name.toLowerCase().includes(normalized) ||
      entry.description.toLowerCase().includes(normalized) ||
      entry.category.toLowerCase().includes(normalized) ||
      entry.id.toLowerCase().includes(normalized)
    );
  });
}

export function createInstanceFromCatalog(
  entry: WidgetCatalogEntry,
  instanceId: string,
): PageWidget {
  if (entry.kind === "placeholder") {
    const defaults = entry.placeholderDefaults;
    if (!defaults) {
      throw new Error(`Placeholder catalog entry ${entry.id} is missing defaults`);
    }
    const widget: PlaceholderWidget = {
      kind: "placeholder",
      id: instanceId,
      title: defaults.title,
      description: defaults.description,
      tone: defaults.tone,
      enabled: true,
      lastUpdatedAt: null,
    };
    return widget;
  }

  const widget: TypedWidgetInstance = {
    kind: "widget",
    id: instanceId,
    type: entry.id,
    title: entry.name,
    enabled: true,
    refreshIntervalSeconds: null,
    config: structuredClone(entry.defaultConfig ?? {}),
    schemaVersion: entry.schemaVersion ?? 1,
    lastUpdatedAt: null,
  };
  return widget;
}

export function shouldOpenSettingsAfterAdd(entry: WidgetCatalogEntry): boolean {
  return (
    entry.requiresConfigurationOnAdd ||
    entry.capabilities.requiresIntegration ||
    (entry.capabilities.hasSettings && entry.kind === "widget" && entry.id === "needs-setup")
  );
}

export function catalogEntryForInstance(widget: PageWidget): WidgetCatalogEntry | undefined {
  if (widget.kind === "widget") {
    return getCatalogEntry(widget.type);
  }
  const match = WIDGET_CATALOG.find(
    (entry) =>
      entry.kind === "placeholder" &&
      entry.placeholderDefaults?.title.toLowerCase() ===
        widget.title.toLowerCase().replace(/ copy$/, ""),
  );
  return match ?? getCatalogEntry("placeholder:notes");
}

export function formatDefaultSize(size: WidgetPlacementSize): string {
  return `${size.colSpan}×${size.rowSpan}`;
}

export function newWidgetInstanceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `a${Date.now().toString(16).padStart(11, "0")}-1111-4111-8111-${Math.floor(
    Math.random() * 1e12,
  )
    .toString(16)
    .padStart(12, "0")}`;
}

export {
  SEARCH_WIDGET_ID,
  CLOCK_WIDGET_ID,
  BOOKMARKS_WIDGET_ID,
  TODO_WIDGET_ID,
  WEATHER_WIDGET_ID,
  RSS_WIDGET_ID,
  CALENDAR_WIDGET_ID,
  GITHUB_REPOSITORY_WIDGET_ID,
  GITHUB_RELEASES_WIDGET_ID,
  MARKETS_WIDGET_ID,
  DEMO_METRICS_WIDGET_ID,
};
