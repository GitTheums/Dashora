import { describe, expect, it, vi } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import type { CryptoMarketAdapter, EquitiesMarketAdapter, MarketQuotePayload } from "./adapter.js";
import { MarketsAdapterError } from "./adapter.js";
import {
  MARKETS_DEFAULT_CONFIG,
  type MarketSymbolConfig,
  type MarketsConfig,
  marketsConfigSchema,
} from "./config.js";
import { marketsDefinition } from "./definition.js";
import { formatMarketPercent, formatMarketPrice, movementTone } from "./format.js";
import { createMarketsProvider } from "./provider.js";
import { resolveCryptoProviderSymbol } from "./symbols.js";

const btcId = "11111111-1111-4111-8111-111111111101";
const aaplId = "11111111-1111-4111-8111-111111111102";

const btcSymbol: MarketSymbolConfig = {
  id: btcId,
  symbol: "BTC",
  assetClass: "crypto",
  label: "Bitcoin",
};

const aaplSymbol: MarketSymbolConfig = {
  id: aaplId,
  symbol: "AAPL",
  assetClass: "equity",
  label: "Apple",
};

function sampleCryptoQuote(now = "2026-07-30T12:00:00.000Z"): MarketQuotePayload {
  return {
    requestId: btcId,
    symbol: "BTC",
    name: "Bitcoin",
    assetClass: "crypto",
    price: 64_250.12,
    changeAbsolute: 1210.5,
    changePercent: 1.92,
    currency: "USD",
    sparkline: [62_000, 63_000, 62_800, 64_250],
    marketState: "open",
    asOf: now,
    providerId: "coingecko",
  };
}

function sampleEquityQuote(now = "2026-07-30T12:00:00.000Z"): MarketQuotePayload {
  return {
    requestId: aaplId,
    symbol: "AAPL",
    name: "Apple",
    assetClass: "equity",
    price: 214.35,
    changeAbsolute: -1.25,
    changePercent: -0.58,
    currency: "USD",
    sparkline: [216, 215.5, 214.8, 214.35],
    marketState: "closed",
    asOf: now,
    providerId: "finnhub",
  };
}

function createCryptoAdapter(overrides: Partial<CryptoMarketAdapter> = {}): CryptoMarketAdapter {
  return {
    id: "mock-crypto",
    isConfigured: (apiKey) => Boolean(apiKey),
    fetchQuotes: vi.fn(async () => ({
      quotes: [sampleCryptoQuote()],
      cacheStatus: "miss" as const,
      providerId: "mock-crypto",
    })),
    ...overrides,
  };
}

function createEquitiesAdapter(
  overrides: Partial<EquitiesMarketAdapter> = {},
): EquitiesMarketAdapter {
  return {
    id: "mock-equities",
    isConfigured: (apiKey) => Boolean(apiKey),
    fetchQuotes: vi.fn(async () => ({
      quotes: [sampleEquityQuote()],
      cacheStatus: "miss" as const,
      providerId: "mock-equities",
    })),
    ...overrides,
  };
}

function configWith(symbols: MarketSymbolConfig[]): MarketsConfig {
  return marketsConfigSchema.parse({
    ...MARKETS_DEFAULT_CONFIG,
    symbols,
  });
}

describe("markets definition", () => {
  it("covers every required runtime state", () => {
    expect(marketsDefinition.states).toEqual(REQUIRED_WIDGET_STATES);
    expect(marketsDefinition.id).toBe("markets");
    expect(marketsDefinition.category).toBe("finance");
  });

  it("parses default config", () => {
    expect(marketsConfigSchema.parse({})).toEqual(MARKETS_DEFAULT_CONFIG);
  });
});

describe("markets symbols", () => {
  it("maps common crypto tickers to provider ids", () => {
    expect(resolveCryptoProviderSymbol("BTC")).toBe("bitcoin");
    expect(resolveCryptoProviderSymbol("ETH", "ethereum")).toBe("ethereum");
    expect(resolveCryptoProviderSymbol("XYZ")).toBe("xyz");
  });
});

describe("markets formatting", () => {
  it("formats prices and movement", () => {
    expect(formatMarketPrice(214.35, "USD")).toContain("214");
    expect(formatMarketPercent(1.92)).toBe("+1.92%");
    expect(formatMarketPercent(-0.58)).toBe("-0.58%");
    expect(movementTone(1)).toBe("up");
    expect(movementTone(-1)).toBe("down");
    expect(movementTone(0)).toBe("neutral");
  });
});

describe("markets provider", () => {
  it("returns configuration-required without symbols", async () => {
    const provider = createMarketsProvider({
      cryptoAdapter: createCryptoAdapter(),
      equitiesAdapter: createEquitiesAdapter(),
      resolveCryptoApiKey: () => "cg-demo",
      resolveEquitiesApiKey: () => "fh-demo",
    });
    const result = await provider.fetch({
      instanceId: "m1",
      config: MARKETS_DEFAULT_CONFIG,
    });
    expect(result.state).toBe("configuration-required");
  });

  it("returns configuration-required when crypto key is missing", async () => {
    const provider = createMarketsProvider({
      cryptoAdapter: createCryptoAdapter(),
      equitiesAdapter: createEquitiesAdapter(),
      resolveCryptoApiKey: () => null,
      resolveEquitiesApiKey: () => "fh-demo",
    });
    const result = await provider.fetch({
      instanceId: "m2",
      config: configWith([btcSymbol]),
    });
    expect(result.state).toBe("configuration-required");
    expect(result.message).toMatch(/COINGECKO_API_KEY/);
  });

  it("returns configuration-required when equities key is missing", async () => {
    const provider = createMarketsProvider({
      cryptoAdapter: createCryptoAdapter(),
      equitiesAdapter: createEquitiesAdapter(),
      resolveCryptoApiKey: () => "cg-demo",
      resolveEquitiesApiKey: () => null,
    });
    const result = await provider.fetch({
      instanceId: "m3",
      config: configWith([aaplSymbol]),
    });
    expect(result.state).toBe("configuration-required");
    expect(result.message).toMatch(/FINNHUB_API_KEY/);
  });

  it("returns disabled when enabled is false", async () => {
    const provider = createMarketsProvider({
      cryptoAdapter: createCryptoAdapter(),
      equitiesAdapter: createEquitiesAdapter(),
      resolveCryptoApiKey: () => "cg-demo",
      resolveEquitiesApiKey: () => "fh-demo",
    });
    const result = await provider.fetch({
      instanceId: "m4",
      config: { ...configWith([btcSymbol]), enabled: false },
    });
    expect(result.state).toBe("disabled");
  });

  it("returns success with mixed crypto and equity quotes", async () => {
    const cryptoAdapter = createCryptoAdapter();
    const equitiesAdapter = createEquitiesAdapter();
    const provider = createMarketsProvider({
      cryptoAdapter,
      equitiesAdapter,
      resolveCryptoApiKey: () => "cg-demo",
      resolveEquitiesApiKey: () => "fh-demo",
    });
    const result = await provider.fetch({
      instanceId: "m5",
      config: configWith([btcSymbol, aaplSymbol]),
    });
    expect(result.state).toBe("success");
    expect(result.data?.quotes).toHaveLength(2);
    expect(result.data?.quotes[0]?.symbol).toBe("BTC");
    expect(result.data?.quotes[1]?.marketState).toBe("closed");
    expect(cryptoAdapter.fetchQuotes).toHaveBeenCalled();
    expect(equitiesAdapter.fetchQuotes).toHaveBeenCalled();
  });

  it("returns stale when an adapter reports stale cache", async () => {
    const provider = createMarketsProvider({
      cryptoAdapter: createCryptoAdapter({
        fetchQuotes: vi.fn(async () => ({
          quotes: [sampleCryptoQuote()],
          cacheStatus: "stale" as const,
          providerId: "mock-crypto",
        })),
      }),
      equitiesAdapter: createEquitiesAdapter(),
      resolveCryptoApiKey: () => "cg-demo",
      resolveEquitiesApiKey: () => "fh-demo",
    });
    const result = await provider.fetch({
      instanceId: "m6",
      config: configWith([btcSymbol]),
    });
    expect(result.state).toBe("stale");
    expect(result.cacheStatus).toBe("stale");
  });

  it("returns error when an adapter throws", async () => {
    const provider = createMarketsProvider({
      cryptoAdapter: createCryptoAdapter({
        fetchQuotes: vi.fn(async () => {
          throw new MarketsAdapterError("upstream", "CoinGecko unavailable", {
            assetClass: "crypto",
          });
        }),
      }),
      equitiesAdapter: createEquitiesAdapter(),
      resolveCryptoApiKey: () => "cg-demo",
      resolveEquitiesApiKey: () => "fh-demo",
    });
    const result = await provider.fetch({
      instanceId: "m7",
      config: configWith([btcSymbol]),
    });
    expect(result.state).toBe("error");
    expect(result.errorCode).toBe("markets_fetch_failed");
  });

  it("maps rate-limit adapter errors", async () => {
    const provider = createMarketsProvider({
      cryptoAdapter: createCryptoAdapter(),
      equitiesAdapter: createEquitiesAdapter({
        fetchQuotes: vi.fn(async () => {
          throw new MarketsAdapterError("rate_limited", "Finnhub rate limit exceeded.", {
            assetClass: "equity",
            statusCode: 429,
          });
        }),
      }),
      resolveCryptoApiKey: () => "cg-demo",
      resolveEquitiesApiKey: () => "fh-demo",
    });
    const result = await provider.fetch({
      instanceId: "m8",
      config: configWith([aaplSymbol]),
    });
    expect(result.state).toBe("error");
    expect(result.errorCode).toBe("markets_rate_limited");
  });
});
