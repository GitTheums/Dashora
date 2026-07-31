import {
  createWidgetDataResponse,
  createWidgetMetadataRegistry,
  createWidgetServerRegistry,
  toServerRegistration,
  widgetDataResponseSchema,
} from "@dashora/widget-sdk";
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
  type CustomApiAdapter,
  createCustomApiProvider,
  customApiDefinition,
} from "@dashora/widget-sdk/widgets/custom-api/server";
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
  type HackerNewsAdapter,
  createHackerNewsProvider,
  hackerNewsDefinition,
} from "@dashora/widget-sdk/widgets/hacker-news/server";
import {
  type IframeAdapter,
  createIframeProvider,
  iframeDefinition,
} from "@dashora/widget-sdk/widgets/iframe/server";
import {
  type LobstersAdapter,
  createLobstersProvider,
  lobstersDefinition,
} from "@dashora/widget-sdk/widgets/lobsters/server";
import {
  type CryptoMarketAdapter,
  type EquitiesMarketAdapter,
  createMarketsProvider,
  marketsDefinition,
} from "@dashora/widget-sdk/widgets/markets/server";
import {
  type RedditAdapter,
  type RedditCredentials,
  createRedditProvider,
  redditDefinition,
} from "@dashora/widget-sdk/widgets/reddit/server";
import { createRssProvider, rssDefinition } from "@dashora/widget-sdk/widgets/rss/server";
import { searchDefinition, searchProvider } from "@dashora/widget-sdk/widgets/search/server";
import {
  type TodoItem,
  createTodoProvider,
  todoDefinition,
} from "@dashora/widget-sdk/widgets/todo/server";
import {
  type TwitchAdapter,
  type TwitchCredentials,
  createTwitchProvider,
  twitchDefinition,
} from "@dashora/widget-sdk/widgets/twitch/server";
import {
  type WeatherProviderAdapter,
  createWeatherProvider,
  weatherDefinition,
} from "@dashora/widget-sdk/widgets/weather/server";
import {
  type YoutubeAdapter,
  createYoutubeProvider,
  youtubeDefinition,
} from "@dashora/widget-sdk/widgets/youtube/server";
import { createPlatformIcsFeedFetcher } from "../providers/calendar/feed-fetcher.js";
import { createCustomApiAdapter } from "../providers/custom-api/api.js";
import { createGithubAdapters } from "../providers/github/api.js";
import { createHackerNewsAdapter } from "../providers/hacker-news/api.js";
import { createIframeEmbedProbeAdapter } from "../providers/iframe/embed-probe.js";
import { createLobstersAdapter } from "../providers/lobsters/api.js";
import { createCoinGeckoCryptoAdapter } from "../providers/markets/coingecko.js";
import { createFinnhubEquitiesAdapter } from "../providers/markets/finnhub.js";
import type { ProviderPlatform } from "../providers/platform.js";
import { createRedditAdapter } from "../providers/reddit/api.js";
import { createPlatformRssFeedFetcher } from "../providers/rss/feed-fetcher.js";
import { createTwitchAdapter } from "../providers/twitch/api.js";
import { createOpenMeteoWeatherAdapter } from "../providers/weather/open-meteo.js";
import { createYoutubeAdapter } from "../providers/youtube/api.js";
import type { TodoService } from "../services/todo-service.js";

export type DashoraWidgetServerRegistryOptions = {
  todoService?: TodoService;
  providers?: ProviderPlatform;
  weatherAdapter?: WeatherProviderAdapter;
  cryptoMarketAdapter?: CryptoMarketAdapter;
  equitiesMarketAdapter?: EquitiesMarketAdapter;
  githubRepositoryAdapter?: GithubRepositoryAdapter;
  githubReleasesAdapter?: GithubReleasesAdapter;
  hackerNewsAdapter?: HackerNewsAdapter;
  lobstersAdapter?: LobstersAdapter;
  redditAdapter?: RedditAdapter;
  youtubeAdapter?: YoutubeAdapter;
  twitchAdapter?: TwitchAdapter;
  customApiAdapter?: CustomApiAdapter;
  iframeAdapter?: IframeAdapter;
  resolveGithubToken?: () => string | null;
  resolveCryptoApiKey?: () => string | null;
  resolveEquitiesApiKey?: () => string | null;
  resolveRedditCredentials?: () => RedditCredentials | null;
  resolveTwitchCredentials?: () => TwitchCredentials | null;
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

const unavailableHackerNewsAdapter: HackerNewsAdapter = {
  id: "unavailable",
  async fetchStories() {
    throw new Error("Hacker News provider platform is not configured");
  },
};

const unavailableLobstersAdapter: LobstersAdapter = {
  id: "unavailable",
  async fetchSource() {
    throw new Error("Lobsters provider platform is not configured");
  },
};

const unavailableRedditAdapter: RedditAdapter = {
  id: "unavailable",
  isConfigured: () => false,
  async fetchSubreddit() {
    throw new Error("Reddit provider platform is not configured");
  },
};

const unavailableYoutubeAdapter: YoutubeAdapter = {
  id: "unavailable",
  async fetchChannel() {
    throw new Error("YouTube provider platform is not configured");
  },
};

const unavailableTwitchAdapter: TwitchAdapter = {
  id: "unavailable",
  isConfigured: () => false,
  async fetchChannels() {
    throw new Error("Twitch provider platform is not configured");
  },
};

const unavailableCustomApiAdapter: CustomApiAdapter = {
  id: "unavailable",
  async fetch() {
    throw new Error("Custom API provider platform is not configured");
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

  const hackerNewsAdapter =
    options.hackerNewsAdapter ??
    (options.providers
      ? createHackerNewsAdapter({ platform: options.providers })
      : unavailableHackerNewsAdapter);

  const lobstersAdapter =
    options.lobstersAdapter ??
    (options.providers
      ? createLobstersAdapter({ platform: options.providers })
      : unavailableLobstersAdapter);

  const redditAdapter =
    options.redditAdapter ??
    (options.providers
      ? createRedditAdapter({ platform: options.providers })
      : unavailableRedditAdapter);

  const youtubeAdapter =
    options.youtubeAdapter ??
    (options.providers
      ? createYoutubeAdapter({ platform: options.providers })
      : unavailableYoutubeAdapter);

  const twitchAdapter =
    options.twitchAdapter ??
    (options.providers
      ? createTwitchAdapter({ platform: options.providers })
      : unavailableTwitchAdapter);

  const customApiAdapter =
    options.customApiAdapter ??
    (options.providers
      ? createCustomApiAdapter({ platform: options.providers })
      : unavailableCustomApiAdapter);

  const iframeAdapter =
    options.iframeAdapter ??
    (options.providers
      ? createIframeEmbedProbeAdapter({ platform: options.providers })
      : undefined);

  const resolveGithubToken = options.resolveGithubToken ?? (() => null);
  const resolveCryptoApiKey = options.resolveCryptoApiKey ?? (() => null);
  const resolveEquitiesApiKey = options.resolveEquitiesApiKey ?? (() => null);
  const resolveRedditCredentials = options.resolveRedditCredentials ?? (() => null);
  const resolveTwitchCredentials = options.resolveTwitchCredentials ?? (() => null);

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
    toServerRegistration(
      hackerNewsDefinition,
      createHackerNewsProvider({ adapter: hackerNewsAdapter }),
    ),
    toServerRegistration(lobstersDefinition, createLobstersProvider({ adapter: lobstersAdapter })),
    toServerRegistration(
      redditDefinition,
      createRedditProvider({
        adapter: redditAdapter,
        resolveCredentials: resolveRedditCredentials,
      }),
    ),
    toServerRegistration(youtubeDefinition, createYoutubeProvider({ adapter: youtubeAdapter })),
    toServerRegistration(
      twitchDefinition,
      createTwitchProvider({
        adapter: twitchAdapter,
        resolveCredentials: resolveTwitchCredentials,
      }),
    ),
    toServerRegistration(
      customApiDefinition,
      createCustomApiProvider({ adapter: customApiAdapter }),
    ),
    toServerRegistration(
      iframeDefinition,
      createIframeProvider(iframeAdapter ? { adapter: iframeAdapter } : {}),
    ),
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
  hackerNewsDefinition,
  lobstersDefinition,
  redditDefinition,
  youtubeDefinition,
  twitchDefinition,
  customApiDefinition,
  iframeDefinition,
]);

export { createWidgetDataResponse, widgetDataResponseSchema };
