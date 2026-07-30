import {
  createWidgetDataResponse,
  createWidgetMetadataRegistry,
  createWidgetServerRegistry,
  toServerRegistration,
  widgetDataResponseSchema,
} from "@dashora/widget-sdk";
import {
  demoMetricsDefinition,
  demoMetricsProvider,
} from "@dashora/widget-sdk/examples/demo-metrics/server";
import {
  bookmarksDefinition,
  bookmarksProvider,
} from "@dashora/widget-sdk/widgets/bookmarks/server";
import {
  calendarDefinition,
  createCalendarProvider,
} from "@dashora/widget-sdk/widgets/calendar/server";
import { clockDefinition, clockProvider } from "@dashora/widget-sdk/widgets/clock/server";
import {
  type GithubReleasesAdapter,
  createGithubReleasesProvider,
  githubReleasesDefinition,
} from "@dashora/widget-sdk/widgets/github-releases/server";
import {
  type GithubRepositoryAdapter,
  createGithubRepositoryProvider,
  githubRepositoryDefinition,
} from "@dashora/widget-sdk/widgets/github-repository/server";
import {
  type CryptoMarketAdapter,
  type EquitiesMarketAdapter,
  createMarketsProvider,
  marketsDefinition,
} from "@dashora/widget-sdk/widgets/markets/server";
import { createRssProvider, rssDefinition } from "@dashora/widget-sdk/widgets/rss/server";
import { searchDefinition, searchProvider } from "@dashora/widget-sdk/widgets/search/server";
import {
  type TodoItem,
  createTodoProvider,
  todoDefinition,
} from "@dashora/widget-sdk/widgets/todo/server";
import {
  type WeatherProviderAdapter,
  createWeatherProvider,
  weatherDefinition,
} from "@dashora/widget-sdk/widgets/weather/server";
import { createPlatformIcsFeedFetcher } from "../providers/calendar/feed-fetcher.js";
import { createGithubAdapters } from "../providers/github/api.js";
import { createCoinGeckoCryptoAdapter } from "../providers/markets/coingecko.js";
import { createFinnhubEquitiesAdapter } from "../providers/markets/finnhub.js";
import type { ProviderPlatform } from "../providers/platform.js";
import { createPlatformRssFeedFetcher } from "../providers/rss/feed-fetcher.js";
import { createOpenMeteoWeatherAdapter } from "../providers/weather/open-meteo.js";
import type { TodoService } from "../services/todo-service.js";

export type DashoraWidgetServerRegistryOptions = {
  todoService?: TodoService;
  providers?: ProviderPlatform;
  weatherAdapter?: WeatherProviderAdapter;
  cryptoMarketAdapter?: CryptoMarketAdapter;
  equitiesMarketAdapter?: EquitiesMarketAdapter;
  githubRepositoryAdapter?: GithubRepositoryAdapter;
  githubReleasesAdapter?: GithubReleasesAdapter;
  resolveGithubToken?: () => string | null;
  resolveCryptoApiKey?: () => string | null;
  resolveEquitiesApiKey?: () => string | null;
};

const unavailableWeatherAdapter: WeatherProviderAdapter = {
  id: "unavailable",
  async searchLocations() {
    return [];
  },
  async fetchForecast() {
    throw new Error("Weather provider platform is not configured");
  },
};

const unavailableGithubRepositoryAdapter: GithubRepositoryAdapter = {
  id: "unavailable",
  async fetchRepository() {
    throw new Error("GitHub provider platform is not configured");
  },
};

const unavailableGithubReleasesAdapter: GithubReleasesAdapter = {
  id: "unavailable",
  async fetchLatestRelease() {
    throw new Error("GitHub provider platform is not configured");
  },
};

const unavailableCryptoAdapter: CryptoMarketAdapter = {
  id: "unavailable",
  isConfigured: () => false,
  async fetchQuotes() {
    throw new Error("Markets crypto provider platform is not configured");
  },
};

const unavailableEquitiesAdapter: EquitiesMarketAdapter = {
  id: "unavailable",
  isConfigured: () => false,
  async fetchQuotes() {
    throw new Error("Markets equities provider platform is not configured");
  },
};

export function createDashoraWidgetServerRegistry(
  options: DashoraWidgetServerRegistryOptions = {},
) {
  const todoProvider = createTodoProvider({
    listByInstance: async (instanceId) => {
      if (!options.todoService) {
        return [] as TodoItem[];
      }
      void instanceId;
      return [];
    },
  });

  const weatherAdapter =
    options.weatherAdapter ??
    (options.providers
      ? createOpenMeteoWeatherAdapter(options.providers)
      : unavailableWeatherAdapter);

  const rssFetcher = options.providers
    ? createPlatformRssFeedFetcher(options.providers)
    : {
        async fetchFeed() {
          throw new Error("RSS provider platform is not configured");
        },
      };

  const calendarFetcher = options.providers
    ? createPlatformIcsFeedFetcher(options.providers)
    : {
        async fetchFeed() {
          throw new Error("Calendar provider platform is not configured");
        },
      };

  const githubAdapters = options.providers ? createGithubAdapters(options.providers) : null;
  const githubRepositoryAdapter =
    options.githubRepositoryAdapter ??
    githubAdapters?.repository ??
    unavailableGithubRepositoryAdapter;
  const githubReleasesAdapter =
    options.githubReleasesAdapter ?? githubAdapters?.releases ?? unavailableGithubReleasesAdapter;

  const cryptoMarketAdapter =
    options.cryptoMarketAdapter ??
    (options.providers
      ? createCoinGeckoCryptoAdapter({ platform: options.providers })
      : unavailableCryptoAdapter);
  const equitiesMarketAdapter =
    options.equitiesMarketAdapter ??
    (options.providers
      ? createFinnhubEquitiesAdapter({ platform: options.providers })
      : unavailableEquitiesAdapter);

  const resolveGithubToken = options.resolveGithubToken ?? (() => null);
  const resolveCryptoApiKey = options.resolveCryptoApiKey ?? (() => null);
  const resolveEquitiesApiKey = options.resolveEquitiesApiKey ?? (() => null);

  return createWidgetServerRegistry([
    toServerRegistration(searchDefinition, searchProvider),
    toServerRegistration(clockDefinition, clockProvider),
    toServerRegistration(bookmarksDefinition, bookmarksProvider),
    toServerRegistration(todoDefinition, todoProvider),
    toServerRegistration(weatherDefinition, createWeatherProvider({ adapter: weatherAdapter })),
    toServerRegistration(rssDefinition, createRssProvider({ fetcher: rssFetcher })),
    toServerRegistration(calendarDefinition, createCalendarProvider({ fetcher: calendarFetcher })),
    toServerRegistration(
      githubRepositoryDefinition,
      createGithubRepositoryProvider({
        adapter: githubRepositoryAdapter,
        resolveDefaultToken: resolveGithubToken,
      }),
    ),
    toServerRegistration(
      githubReleasesDefinition,
      createGithubReleasesProvider({
        adapter: githubReleasesAdapter,
        resolveDefaultToken: resolveGithubToken,
      }),
    ),
    toServerRegistration(
      marketsDefinition,
      createMarketsProvider({
        cryptoAdapter: cryptoMarketAdapter,
        equitiesAdapter: equitiesMarketAdapter,
        resolveCryptoApiKey,
        resolveEquitiesApiKey,
      }),
    ),
    toServerRegistration(demoMetricsDefinition, demoMetricsProvider),
  ]);
}

export const widgetMetadataRegistry = createWidgetMetadataRegistry([
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

export { createWidgetDataResponse, widgetDataResponseSchema };
