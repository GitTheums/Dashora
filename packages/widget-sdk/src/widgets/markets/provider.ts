import type { WidgetCacheStatus } from "../../cache.js";
import { defineWidgetProvider } from "../../provider.js";
import {
  type CryptoMarketAdapter,
  type EquitiesMarketAdapter,
  type MarketQuotePayload,
  MarketsAdapterError,
  type MarketsAdapterRequest,
  type MarketsSymbolRequest,
  isMarketsAdapterError,
} from "./adapter.js";
import {
  type MarketQuote,
  type MarketsConfig,
  type MarketsData,
  isMarketsConfigured,
  marketsConfigSchema,
  marketsDataSchema,
  symbolsNeedingCrypto,
  symbolsNeedingEquities,
} from "./config.js";
import { MARKETS_WIDGET_ID } from "./definition.js";
import {
  defaultMarketDisplayName,
  resolveCryptoProviderSymbol,
  resolveEquitiesProviderSymbol,
} from "./symbols.js";

export type MarketsProviderDeps = {
  cryptoAdapter: CryptoMarketAdapter;
  equitiesAdapter: EquitiesMarketAdapter;
  resolveCryptoApiKey?: () => string | null;
  resolveEquitiesApiKey?: () => string | null;
};

function worstCacheStatus(statuses: WidgetCacheStatus[]): WidgetCacheStatus {
  if (statuses.includes("stale")) {
    return "stale";
  }
  if (statuses.includes("miss")) {
    return "miss";
  }
  if (statuses.includes("bypass")) {
    return "bypass";
  }
  if (statuses.includes("hit")) {
    return "hit";
  }
  return "miss";
}

function toSymbolRequests(
  config: MarketsConfig,
  assetFilter: "crypto" | "equities",
): MarketsSymbolRequest[] {
  const filtered =
    assetFilter === "crypto" ? symbolsNeedingCrypto(config) : symbolsNeedingEquities(config);

  return filtered.map((symbol) => ({
    ...symbol,
    resolvedProviderSymbol:
      symbol.assetClass === "crypto"
        ? resolveCryptoProviderSymbol(symbol.symbol, symbol.providerSymbol)
        : resolveEquitiesProviderSymbol(symbol.symbol, symbol.providerSymbol),
  }));
}

function mapPayloadToQuote(
  request: MarketsSymbolRequest,
  payload: MarketQuotePayload | undefined,
  currency: string,
): MarketQuote {
  if (!payload) {
    return {
      id: request.id,
      symbol: request.symbol,
      name: defaultMarketDisplayName(request.symbol, request.assetClass, request.label),
      assetClass: request.assetClass,
      price: 0,
      changeAbsolute: 0,
      changePercent: 0,
      currency,
      sparkline: [],
      marketState: "unknown",
      asOf: new Date(0).toISOString(),
      providerId: "unknown",
      status: "error",
      message: "No quote returned for this symbol.",
    };
  }

  return {
    id: request.id,
    symbol: payload.symbol || request.symbol,
    name:
      payload.name || defaultMarketDisplayName(request.symbol, request.assetClass, request.label),
    assetClass: request.assetClass,
    price: payload.price,
    changeAbsolute: payload.changeAbsolute,
    changePercent: payload.changePercent,
    currency: payload.currency || currency,
    sparkline: payload.sparkline,
    marketState: payload.marketState,
    asOf: payload.asOf,
    providerId: payload.providerId,
    status: "ok",
  };
}

function mapAdapterError(
  error: unknown,
  kind: "crypto" | "equities",
): {
  state: "error" | "configuration-required";
  message: string;
  errorCode: string;
} {
  if (isMarketsAdapterError(error)) {
    if (error.code === "not_configured") {
      return {
        state: "configuration-required",
        message:
          kind === "crypto"
            ? "Set COINGECKO_API_KEY on the server to load crypto quotes."
            : "Set FINNHUB_API_KEY on the server to load equity and index quotes.",
        errorCode: "markets_not_configured",
      };
    }
    if (error.code === "unauthorized") {
      return {
        state: "configuration-required",
        message:
          kind === "crypto"
            ? "CoinGecko rejected the API key. Update COINGECKO_API_KEY on the server."
            : "Finnhub rejected the API key. Update FINNHUB_API_KEY on the server.",
        errorCode: "markets_unauthorized",
      };
    }
    if (error.code === "rate_limited") {
      return {
        state: "error",
        message: error.message,
        errorCode: "markets_rate_limited",
      };
    }
    return {
      state: "error",
      message: error.message,
      errorCode: "markets_fetch_failed",
    };
  }
  return {
    state: "error",
    message: "Could not load market quotes.",
    errorCode: "markets_fetch_failed",
  };
}

export function createMarketsProvider(deps: MarketsProviderDeps) {
  return defineWidgetProvider<MarketsConfig, MarketsData>({
    id: MARKETS_WIDGET_ID,
    fetch: async (ctx) => {
      const config = marketsConfigSchema.parse(ctx.config);

      if (!config.enabled) {
        return { state: "disabled", message: "Markets is disabled in settings." };
      }

      if (!isMarketsConfigured(config)) {
        return {
          state: "configuration-required",
          message: "Add at least one symbol in settings to build a watchlist.",
        };
      }

      const cryptoKey = deps.resolveCryptoApiKey?.() ?? null;
      const equitiesKey = deps.resolveEquitiesApiKey?.() ?? null;
      const cryptoRequests = toSymbolRequests(config, "crypto");
      const equitiesRequests = toSymbolRequests(config, "equities");

      if (cryptoRequests.length > 0 && !deps.cryptoAdapter.isConfigured(cryptoKey)) {
        return {
          state: "configuration-required",
          message:
            "Set COINGECKO_API_KEY on the server to load crypto quotes, or remove crypto symbols from the watchlist.",
        };
      }

      if (equitiesRequests.length > 0 && !deps.equitiesAdapter.isConfigured(equitiesKey)) {
        return {
          state: "configuration-required",
          message:
            "Set FINNHUB_API_KEY on the server to load equity and index quotes, or remove those symbols from the watchlist.",
        };
      }

      const now = ctx.now ? ctx.now() : new Date();
      const baseRequest = {
        currency: config.currency,
        range: config.range,
        includeSparkline: config.showSparkline,
        ...(ctx.signal ? { signal: ctx.signal } : {}),
        ...(ctx.forceRefresh !== undefined ? { forceRefresh: ctx.forceRefresh } : {}),
        now,
      };

      const quotesById = new Map<string, MarketQuote>();
      const cacheStatuses: WidgetCacheStatus[] = [];
      const providers = new Set<string>();

      try {
        if (cryptoRequests.length > 0) {
          const request: MarketsAdapterRequest = {
            ...baseRequest,
            symbols: cryptoRequests,
            apiKey: cryptoKey,
          };
          const result = await deps.cryptoAdapter.fetchQuotes(request);
          cacheStatuses.push(result.cacheStatus);
          providers.add(result.providerId);
          const byRequestId = new Map(
            result.quotes
              .filter((quote) => quote.requestId)
              .map((quote) => [quote.requestId as string, quote]),
          );
          const bySymbol = new Map(
            result.quotes.map((quote) => [quote.symbol.toUpperCase(), quote]),
          );
          for (const symbol of cryptoRequests) {
            const payload =
              byRequestId.get(symbol.id) ??
              bySymbol.get(symbol.symbol.toUpperCase()) ??
              bySymbol.get(symbol.resolvedProviderSymbol.toUpperCase());
            quotesById.set(symbol.id, mapPayloadToQuote(symbol, payload, config.currency));
          }
        }

        if (equitiesRequests.length > 0) {
          const request: MarketsAdapterRequest = {
            ...baseRequest,
            symbols: equitiesRequests,
            apiKey: equitiesKey,
          };
          const result = await deps.equitiesAdapter.fetchQuotes(request);
          cacheStatuses.push(result.cacheStatus);
          providers.add(result.providerId);
          const byRequestId = new Map(
            result.quotes
              .filter((quote) => quote.requestId)
              .map((quote) => [quote.requestId as string, quote]),
          );
          const bySymbol = new Map(
            result.quotes.map((quote) => [quote.symbol.toUpperCase(), quote]),
          );
          for (const symbol of equitiesRequests) {
            const payload = byRequestId.get(symbol.id) ?? bySymbol.get(symbol.symbol.toUpperCase());
            quotesById.set(symbol.id, mapPayloadToQuote(symbol, payload, config.currency));
          }
        }
      } catch (error) {
        const kind =
          error instanceof MarketsAdapterError && error.assetClass === "crypto"
            ? "crypto"
            : equitiesRequests.length > 0 && cryptoRequests.length === 0
              ? "equities"
              : error instanceof MarketsAdapterError &&
                  (error.assetClass === "equity" || error.assetClass === "index")
                ? "equities"
                : cryptoRequests.length > 0
                  ? "crypto"
                  : "equities";
        return mapAdapterError(error, kind);
      }

      const quotes = config.symbols
        .map((symbol) => quotesById.get(symbol.id))
        .filter((quote): quote is MarketQuote => quote !== undefined);

      if (quotes.length === 0) {
        return {
          state: "empty",
          message: "No market quotes were returned for the configured symbols.",
        };
      }

      const okQuotes = quotes.filter((quote) => quote.status === "ok");
      if (okQuotes.length === 0) {
        return {
          state: "error",
          data: marketsDataSchema.parse({
            layout: config.layout,
            range: config.range,
            showRangeSelector: config.showRangeSelector,
            showSparkline: config.showSparkline,
            showAbsoluteChange: config.showAbsoluteChange,
            currency: config.currency,
            quotes,
            fetchedAt: now.toISOString(),
            providers: [...providers],
          }),
          message: "Could not load any market quotes for the configured symbols.",
          errorCode: "markets_all_failed",
        };
      }

      const data = marketsDataSchema.parse({
        layout: config.layout,
        range: config.range,
        showRangeSelector: config.showRangeSelector,
        showSparkline: config.showSparkline,
        showAbsoluteChange: config.showAbsoluteChange,
        currency: config.currency,
        quotes,
        fetchedAt: now.toISOString(),
        providers: [...providers],
      });

      const cacheStatus = worstCacheStatus(cacheStatuses);

      if (cacheStatus === "stale" || okQuotes.length < quotes.length) {
        return {
          state: "stale",
          data,
          message:
            okQuotes.length < quotes.length
              ? "Showing partial market data; some symbols failed to refresh."
              : "Showing last good market data while a refresh is due.",
          cacheStatus: "stale",
        };
      }

      if (ctx.forceRefresh) {
        return {
          state: "refreshing",
          data,
          message: "Refreshing market quotes…",
          cacheStatus,
        };
      }

      return {
        state: "success",
        data,
        cacheStatus,
      };
    },
  });
}
