import type { WidgetCacheStatus } from "../../cache.js";
import type { MarketAssetClass, MarketQuote, MarketRange, MarketSymbolConfig } from "./config.js";

/**
 * Normalized quote returned by a markets provider adapter.
 * Layout / display flags are applied by the widget provider from config.
 */
export type MarketQuotePayload = Omit<MarketQuote, "id" | "status" | "message"> & {
  /** Optional correlation back to the configured symbol id. */
  requestId?: string;
};

export type MarketsSymbolRequest = MarketSymbolConfig & {
  /** Resolved provider identifier (never a secret). */
  resolvedProviderSymbol: string;
};

export type MarketsAdapterRequest = {
  symbols: MarketsSymbolRequest[];
  currency: string;
  range: MarketRange;
  includeSparkline: boolean;
  apiKey: string | null;
  signal?: AbortSignal;
  forceRefresh?: boolean;
  now?: Date;
};

export type MarketsAdapterResult = {
  quotes: MarketQuotePayload[];
  cacheStatus: WidgetCacheStatus;
  providerId: string;
};

export type MarketsAdapterErrorCode =
  | "not_configured"
  | "unauthorized"
  | "rate_limited"
  | "not_found"
  | "upstream"
  | "invalid_symbol";

export class MarketsAdapterError extends Error {
  readonly code: MarketsAdapterErrorCode;
  readonly statusCode?: number;
  readonly assetClass?: MarketAssetClass;

  constructor(
    code: MarketsAdapterErrorCode,
    message: string,
    options?: { statusCode?: number; assetClass?: MarketAssetClass; cause?: unknown },
  ) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "MarketsAdapterError";
    this.code = code;
    if (options?.statusCode !== undefined) {
      this.statusCode = options.statusCode;
    }
    if (options?.assetClass !== undefined) {
      this.assetClass = options.assetClass;
    }
  }
}

export function isMarketsAdapterError(error: unknown): error is MarketsAdapterError {
  return error instanceof MarketsAdapterError;
}

/**
 * Crypto asset upstream. Production uses CoinGecko; tests inject fakes.
 */
export type CryptoMarketAdapter = {
  readonly id: string;
  /** When false, the widget provider returns configuration-required for crypto symbols. */
  isConfigured: (apiKey: string | null) => boolean;
  fetchQuotes: (request: MarketsAdapterRequest) => Promise<MarketsAdapterResult>;
};

/**
 * Equities and indexes upstream. Production uses Finnhub; tests inject fakes.
 */
export type EquitiesMarketAdapter = {
  readonly id: string;
  /** When false, the widget provider returns configuration-required for equity/index symbols. */
  isConfigured: (apiKey: string | null) => boolean;
  fetchQuotes: (request: MarketsAdapterRequest) => Promise<MarketsAdapterResult>;
};
