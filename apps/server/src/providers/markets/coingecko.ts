import {
  type CryptoMarketAdapter,
  type MarketQuotePayload,
  MarketsAdapterError,
  type MarketsAdapterRequest,
  type MarketsAdapterResult,
  defaultMarketDisplayName,
} from "@dashora/widget-sdk/widgets/markets/server";
import type { MarketRange } from "@dashora/widget-sdk/widgets/markets/server";
import { type ProviderError, isProviderError } from "../errors.js";
import type { ProviderPlatform } from "../platform.js";

const COINGECKO_API_BASE = "https://api.coingecko.com/api/v3";

type CoinGeckoSimplePriceResponse = Record<
  string,
  {
    [currency: string]: number | undefined;
  } & {
    last_updated_at?: number;
  }
>;

type CoinGeckoMarketChartResponse = {
  prices?: Array<[number, number]>;
};

function rangeToDays(range: MarketRange): string {
  switch (range) {
    case "1d":
      return "1";
    case "7d":
      return "7";
    case "30d":
      return "30";
    case "90d":
      return "90";
    case "1y":
      return "365";
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

function currencyField(currency: string): string {
  return currency.trim().toLowerCase();
}

function changeField(currency: string): string {
  return `${currencyField(currency)}_24h_change`;
}

function apiHeaders(apiKey: string | null, baseUrl: string): Record<string, string> {
  if (!apiKey) {
    return {};
  }
  // Pro hosts use x-cg-pro-api-key; Demo/public hosts use x-cg-demo-api-key.
  if (baseUrl.includes("pro-api.coingecko.com")) {
    return { "x-cg-pro-api-key": apiKey };
  }
  return { "x-cg-demo-api-key": apiKey };
}

function mapCoinGeckoError(error: ProviderError): MarketsAdapterError {
  const status = error.statusCode;
  if (error.code === "rate_limited" || status === 429) {
    return new MarketsAdapterError(
      "rate_limited",
      "CoinGecko API rate limit exceeded. Try again later.",
      { statusCode: status ?? 429, assetClass: "crypto", cause: error },
    );
  }
  if (status === 401 || status === 403) {
    return new MarketsAdapterError(
      "unauthorized",
      "CoinGecko rejected the API key. Update COINGECKO_API_KEY on the server.",
      { statusCode: status, assetClass: "crypto", cause: error },
    );
  }
  return new MarketsAdapterError("upstream", "Could not load crypto quotes from CoinGecko.", {
    ...(status !== undefined ? { statusCode: status } : {}),
    assetClass: "crypto",
    cause: error,
  });
}

export type CoinGeckoAdapterOptions = {
  platform: ProviderPlatform;
  baseUrl?: string;
};

export function createCoinGeckoCryptoAdapter(
  options: CoinGeckoAdapterOptions,
): CryptoMarketAdapter {
  const baseUrl = (options.baseUrl ?? COINGECKO_API_BASE).replace(/\/$/, "");

  return {
    id: "coingecko",

    isConfigured(apiKey) {
      return typeof apiKey === "string" && apiKey.trim().length > 0;
    },

    async fetchQuotes(request: MarketsAdapterRequest): Promise<MarketsAdapterResult> {
      if (!this.isConfigured(request.apiKey)) {
        throw new MarketsAdapterError(
          "not_configured",
          "Set COINGECKO_API_KEY on the server to load crypto quotes.",
          { assetClass: "crypto" },
        );
      }

      if (request.symbols.length === 0) {
        return { quotes: [], cacheStatus: "bypass", providerId: "coingecko" };
      }

      const now = request.now ?? new Date();
      const vs = currencyField(request.currency);
      const ids = [...new Set(request.symbols.map((symbol) => symbol.resolvedProviderSymbol))];
      const priceUrl = new URL(`${baseUrl}/simple/price`);
      priceUrl.searchParams.set("ids", ids.join(","));
      priceUrl.searchParams.set("vs_currencies", vs);
      priceUrl.searchParams.set("include_24hr_change", "true");
      priceUrl.searchParams.set("include_last_updated_at", "true");

      let priceData: CoinGeckoSimplePriceResponse;
      let cacheStatus: MarketsAdapterResult["cacheStatus"];
      try {
        const priceResult = await options.platform.fetchJson<CoinGeckoSimplePriceResponse>({
          providerId: "markets-crypto",
          url: priceUrl.toString(),
          headers: apiHeaders(request.apiKey, baseUrl),
          ...(request.signal ? { signal: request.signal } : {}),
          ...(request.forceRefresh !== undefined ? { forceRefresh: request.forceRefresh } : {}),
          cachePolicy: { ttlSeconds: 60, staleWhileRevalidateSeconds: 300 },
        });
        priceData = priceResult.data;
        cacheStatus = priceResult.result.cacheStatus;
      } catch (error) {
        if (isProviderError(error)) {
          throw mapCoinGeckoError(error);
        }
        throw error;
      }

      const quotes: MarketQuotePayload[] = [];

      for (const symbol of request.symbols) {
        const row = priceData[symbol.resolvedProviderSymbol];
        const price = row?.[vs];
        if (typeof price !== "number" || !Number.isFinite(price)) {
          continue;
        }
        const changePercentRaw = row?.[changeField(request.currency)];
        const changePercent =
          typeof changePercentRaw === "number" && Number.isFinite(changePercentRaw)
            ? changePercentRaw
            : 0;
        const previous = changePercent === -100 ? 0 : price / (1 + changePercent / 100);
        const changeAbsolute = price - previous;
        const asOfMs =
          typeof row?.last_updated_at === "number" && Number.isFinite(row.last_updated_at)
            ? row.last_updated_at * 1000
            : now.getTime();

        let sparkline: number[] = [];
        if (request.includeSparkline) {
          const chartUrl = new URL(
            `${baseUrl}/coins/${encodeURIComponent(symbol.resolvedProviderSymbol)}/market_chart`,
          );
          chartUrl.searchParams.set("vs_currency", vs);
          chartUrl.searchParams.set("days", rangeToDays(request.range));
          try {
            const chartResult = await options.platform.fetchJson<CoinGeckoMarketChartResponse>({
              providerId: "markets-crypto",
              url: chartUrl.toString(),
              headers: apiHeaders(request.apiKey, baseUrl),
              ...(request.signal ? { signal: request.signal } : {}),
              ...(request.forceRefresh !== undefined ? { forceRefresh: request.forceRefresh } : {}),
              cachePolicy: { ttlSeconds: 300, staleWhileRevalidateSeconds: 900 },
            });
            if (chartResult.result.cacheStatus === "stale") {
              cacheStatus = "stale";
            }
            sparkline = downsample(
              (chartResult.data.prices ?? [])
                .map((point) => point[1])
                .filter(
                  (value): value is number => typeof value === "number" && Number.isFinite(value),
                ),
            );
          } catch (error) {
            if (
              isProviderError(error) &&
              (error.code === "rate_limited" || error.statusCode === 429)
            ) {
              throw mapCoinGeckoError(error);
            }
            sparkline = [];
          }
        }

        quotes.push({
          requestId: symbol.id,
          symbol: symbol.symbol,
          name: defaultMarketDisplayName(symbol.symbol, "crypto", symbol.label),
          assetClass: "crypto",
          price,
          changeAbsolute,
          changePercent,
          currency: request.currency.toUpperCase(),
          sparkline,
          marketState: "open",
          asOf: new Date(asOfMs).toISOString(),
          providerId: "coingecko",
        });
      }

      return {
        quotes,
        cacheStatus,
        providerId: "coingecko",
      };
    },
  };
}
