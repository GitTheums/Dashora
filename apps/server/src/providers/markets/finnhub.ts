import {
  type EquitiesMarketAdapter,
  type MarketQuotePayload,
  MarketsAdapterError,
  type MarketsAdapterRequest,
  type MarketsAdapterResult,
  defaultMarketDisplayName,
} from "@dashora/widget-sdk/widgets/markets/server";
import type { MarketRange } from "@dashora/widget-sdk/widgets/markets/server";
import { type ProviderError, isProviderError } from "../errors.js";
import type { ProviderPlatform } from "../platform.js";

const FINNHUB_API_BASE = "https://finnhub.io/api/v1";

type FinnhubQuoteResponse = {
  c?: number;
  d?: number;
  dp?: number;
  h?: number;
  l?: number;
  o?: number;
  pc?: number;
  t?: number;
};

type FinnhubCandleResponse = {
  c?: number[];
  s?: string;
  t?: number[];
};

type FinnhubMarketStatusResponse = {
  isOpen?: boolean;
  session?: string;
};

function rangeToCandleParams(
  range: MarketRange,
  nowMs: number,
): {
  resolution: string;
  from: number;
} {
  const second = 1000;
  const day = 86_400 * second;
  switch (range) {
    case "1d":
      return { resolution: "5", from: Math.floor((nowMs - day) / 1000) };
    case "7d":
      return { resolution: "60", from: Math.floor((nowMs - 7 * day) / 1000) };
    case "30d":
      return { resolution: "D", from: Math.floor((nowMs - 30 * day) / 1000) };
    case "90d":
      return { resolution: "D", from: Math.floor((nowMs - 90 * day) / 1000) };
    case "1y":
      return { resolution: "W", from: Math.floor((nowMs - 365 * day) / 1000) };
  }
}

function downsample(values: number[], maxPoints = 32): number[] {
  if (values.length <= maxPoints) {
    return values;
  }
  const result: number[] = [];
  const step = (values.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i += 1) {
    const index = Math.round(i * step);
    const value = values[index];
    if (typeof value === "number" && Number.isFinite(value)) {
      result.push(value);
    }
  }
  return result;
}

function mapFinnhubError(error: ProviderError): MarketsAdapterError {
  const status = error.statusCode;
  if (error.code === "rate_limited" || status === 429) {
    return new MarketsAdapterError(
      "rate_limited",
      "Finnhub API rate limit exceeded. Try again later.",
      { statusCode: status ?? 429, assetClass: "equity", cause: error },
    );
  }
  if (status === 401 || status === 403) {
    return new MarketsAdapterError(
      "unauthorized",
      "Finnhub rejected the API key. Update FINNHUB_API_KEY on the server.",
      { statusCode: status, assetClass: "equity", cause: error },
    );
  }
  return new MarketsAdapterError("upstream", "Could not load equity quotes from Finnhub.", {
    ...(status !== undefined ? { statusCode: status } : {}),
    assetClass: "equity",
    cause: error,
  });
}

export type FinnhubAdapterOptions = {
  platform: ProviderPlatform;
  baseUrl?: string;
  /** Exchange code for market-status checks (US equities by default). */
  exchange?: string;
};

export function createFinnhubEquitiesAdapter(
  options: FinnhubAdapterOptions,
): EquitiesMarketAdapter {
  const baseUrl = (options.baseUrl ?? FINNHUB_API_BASE).replace(/\/$/, "");
  const exchange = options.exchange ?? "US";

  return {
    id: "finnhub",

    isConfigured(apiKey) {
      return typeof apiKey === "string" && apiKey.trim().length > 0;
    },

    async fetchQuotes(request: MarketsAdapterRequest): Promise<MarketsAdapterResult> {
      if (!this.isConfigured(request.apiKey)) {
        throw new MarketsAdapterError(
          "not_configured",
          "Set FINNHUB_API_KEY on the server to load equity and index quotes.",
          { assetClass: "equity" },
        );
      }

      if (request.symbols.length === 0) {
        return { quotes: [], cacheStatus: "bypass", providerId: "finnhub" };
      }

      const apiKey = request.apiKey?.trim() ?? "";
      if (!apiKey) {
        throw new MarketsAdapterError(
          "not_configured",
          "Set FINNHUB_API_KEY on the server to load equity and index quotes.",
          { assetClass: "equity" },
        );
      }
      const now = request.now ?? new Date();
      const nowMs = now.getTime();
      let marketState: "open" | "closed" | "unknown" = "unknown";
      let cacheStatus: MarketsAdapterResult["cacheStatus"] = "miss";

      try {
        const statusUrl = new URL(`${baseUrl}/stock/market-status`);
        statusUrl.searchParams.set("exchange", exchange);
        statusUrl.searchParams.set("token", apiKey);
        const statusResult = await options.platform.fetchJson<FinnhubMarketStatusResponse>({
          providerId: "markets-equities",
          url: statusUrl.toString(),
          ...(request.signal ? { signal: request.signal } : {}),
          ...(request.forceRefresh !== undefined ? { forceRefresh: request.forceRefresh } : {}),
          cachePolicy: { ttlSeconds: 120, staleWhileRevalidateSeconds: 300 },
        });
        cacheStatus = statusResult.result.cacheStatus;
        if (typeof statusResult.data.isOpen === "boolean") {
          marketState = statusResult.data.isOpen ? "open" : "closed";
        }
      } catch {
        marketState = "unknown";
      }

      const quotes: MarketQuotePayload[] = [];

      for (const symbol of request.symbols) {
        const ticker = symbol.resolvedProviderSymbol;
        const quoteUrl = new URL(`${baseUrl}/quote`);
        quoteUrl.searchParams.set("symbol", ticker);
        quoteUrl.searchParams.set("token", apiKey);

        let quoteData: FinnhubQuoteResponse;
        let quoteCacheStatus: MarketsAdapterResult["cacheStatus"];
        try {
          const quoteResult = await options.platform.fetchJson<FinnhubQuoteResponse>({
            providerId: "markets-equities",
            url: quoteUrl.toString(),
            ...(request.signal ? { signal: request.signal } : {}),
            ...(request.forceRefresh !== undefined ? { forceRefresh: request.forceRefresh } : {}),
            cachePolicy: { ttlSeconds: 60, staleWhileRevalidateSeconds: 300 },
          });
          quoteData = quoteResult.data;
          quoteCacheStatus = quoteResult.result.cacheStatus;
        } catch (error) {
          if (isProviderError(error)) {
            throw mapFinnhubError(error);
          }
          throw error;
        }

        if (quoteCacheStatus === "stale") {
          cacheStatus = "stale";
        }

        const price = quoteData.c;
        if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
          continue;
        }

        const changeAbsolute =
          typeof quoteData.d === "number" && Number.isFinite(quoteData.d) ? quoteData.d : 0;
        const changePercent =
          typeof quoteData.dp === "number" && Number.isFinite(quoteData.dp) ? quoteData.dp : 0;
        const asOfMs =
          typeof quoteData.t === "number" && Number.isFinite(quoteData.t)
            ? quoteData.t * 1000
            : nowMs;

        let sparkline: number[] = [];
        if (request.includeSparkline) {
          const { resolution, from } = rangeToCandleParams(request.range, nowMs);
          const candleUrl = new URL(`${baseUrl}/stock/candle`);
          candleUrl.searchParams.set("symbol", ticker);
          candleUrl.searchParams.set("resolution", resolution);
          candleUrl.searchParams.set("from", String(from));
          candleUrl.searchParams.set("to", String(Math.floor(nowMs / 1000)));
          candleUrl.searchParams.set("token", apiKey);
          try {
            const candleResult = await options.platform.fetchJson<FinnhubCandleResponse>({
              providerId: "markets-equities",
              url: candleUrl.toString(),
              ...(request.signal ? { signal: request.signal } : {}),
              ...(request.forceRefresh !== undefined ? { forceRefresh: request.forceRefresh } : {}),
              cachePolicy: { ttlSeconds: 300, staleWhileRevalidateSeconds: 900 },
            });
            if (candleResult.result.cacheStatus === "stale") {
              cacheStatus = "stale";
            }
            if (candleResult.data.s === "ok" && Array.isArray(candleResult.data.c)) {
              sparkline = downsample(
                candleResult.data.c.filter(
                  (value): value is number => typeof value === "number" && Number.isFinite(value),
                ),
              );
            }
          } catch (error) {
            if (
              isProviderError(error) &&
              (error.code === "rate_limited" || error.statusCode === 429)
            ) {
              throw mapFinnhubError(error);
            }
            sparkline = [];
          }
        }

        quotes.push({
          requestId: symbol.id,
          symbol: symbol.symbol,
          name: defaultMarketDisplayName(symbol.symbol, symbol.assetClass, symbol.label),
          assetClass: symbol.assetClass,
          price,
          changeAbsolute,
          changePercent,
          currency: request.currency.toUpperCase(),
          sparkline,
          marketState,
          asOf: new Date(asOfMs).toISOString(),
          providerId: "finnhub",
        });
      }

      return {
        quotes,
        cacheStatus,
        providerId: "finnhub",
      };
    },
  };
}
