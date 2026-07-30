import { describe, expect, it } from "vitest";
import { createTestServerEnv } from "../../test/env.js";
import { createProviderPlatform } from "../platform.js";
import { createCoinGeckoCryptoAdapter } from "./coingecko.js";
import { createFinnhubEquitiesAdapter } from "./finnhub.js";

describe("CoinGecko crypto adapter", () => {
  it("normalizes simple price and sparkline fixtures", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("/simple/price")) {
        return new Response(
          JSON.stringify({
            bitcoin: {
              usd: 64250.12,
              usd_24h_change: 1.92,
              last_updated_at: 1_722_340_800,
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/market_chart")) {
        return new Response(
          JSON.stringify({
            prices: [
              [1, 62_000],
              [2, 63_000],
              [3, 62_800],
              [4, 64_250],
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    };

    const platform = createProviderPlatform({
      env: createTestServerEnv(),
      fetchImpl,
    });
    const adapter = createCoinGeckoCryptoAdapter({ platform });

    expect(adapter.isConfigured(null)).toBe(false);
    expect(adapter.isConfigured("cg-demo-key")).toBe(true);

    const result = await adapter.fetchQuotes({
      symbols: [
        {
          id: "11111111-1111-4111-8111-111111111101",
          symbol: "BTC",
          assetClass: "crypto",
          label: "Bitcoin",
          resolvedProviderSymbol: "bitcoin",
        },
      ],
      currency: "USD",
      range: "7d",
      includeSparkline: true,
      apiKey: "cg-demo-key",
      now: new Date("2026-07-30T12:00:00.000Z"),
    });

    expect(result.providerId).toBe("coingecko");
    expect(result.quotes).toHaveLength(1);
    expect(result.quotes[0]?.price).toBe(64250.12);
    expect(result.quotes[0]?.changePercent).toBe(1.92);
    expect(result.quotes[0]?.sparkline).toEqual([62_000, 63_000, 62_800, 64_250]);
    expect(result.quotes[0]?.marketState).toBe("open");
  });

  it("maps unauthorized responses to MarketsAdapterError", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ error: "invalid" }), { status: 401 });
    const platform = createProviderPlatform({
      env: createTestServerEnv(),
      fetchImpl,
    });
    const adapter = createCoinGeckoCryptoAdapter({ platform });

    await expect(
      adapter.fetchQuotes({
        symbols: [
          {
            id: "11111111-1111-4111-8111-111111111101",
            symbol: "BTC",
            assetClass: "crypto",
            label: "",
            resolvedProviderSymbol: "bitcoin",
          },
        ],
        currency: "USD",
        range: "7d",
        includeSparkline: false,
        apiKey: "bad-key",
      }),
    ).rejects.toMatchObject({ code: "unauthorized" });
  });
});

describe("Finnhub equities adapter", () => {
  it("normalizes quote, candle, and market-status fixtures", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("/stock/market-status")) {
        return new Response(JSON.stringify({ isOpen: false, session: "market" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("/quote")) {
        return new Response(
          JSON.stringify({
            c: 214.35,
            d: -1.25,
            dp: -0.58,
            h: 216,
            l: 213,
            o: 215,
            pc: 215.6,
            t: 1_722_340_800,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/stock/candle")) {
        return new Response(
          JSON.stringify({
            s: "ok",
            c: [216, 215.5, 214.8, 214.35],
            t: [1, 2, 3, 4],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    };

    const platform = createProviderPlatform({
      env: createTestServerEnv(),
      fetchImpl,
    });
    const adapter = createFinnhubEquitiesAdapter({ platform });

    expect(adapter.isConfigured("")).toBe(false);

    const result = await adapter.fetchQuotes({
      symbols: [
        {
          id: "11111111-1111-4111-8111-111111111102",
          symbol: "AAPL",
          assetClass: "equity",
          label: "Apple",
          resolvedProviderSymbol: "AAPL",
        },
      ],
      currency: "USD",
      range: "7d",
      includeSparkline: true,
      apiKey: "fh-demo-key",
      now: new Date("2026-07-30T12:00:00.000Z"),
    });

    expect(result.providerId).toBe("finnhub");
    expect(result.quotes).toHaveLength(1);
    expect(result.quotes[0]?.price).toBe(214.35);
    expect(result.quotes[0]?.changeAbsolute).toBe(-1.25);
    expect(result.quotes[0]?.marketState).toBe("closed");
    expect(result.quotes[0]?.sparkline).toEqual([216, 215.5, 214.8, 214.35]);
  });

  it("requires an API key before calling upstream", async () => {
    const platform = createProviderPlatform({
      env: createTestServerEnv(),
      fetchImpl: async () => new Response("{}", { status: 200 }),
    });
    const adapter = createFinnhubEquitiesAdapter({ platform });

    await expect(
      adapter.fetchQuotes({
        symbols: [
          {
            id: "11111111-1111-4111-8111-111111111102",
            symbol: "AAPL",
            assetClass: "equity",
            label: "",
            resolvedProviderSymbol: "AAPL",
          },
        ],
        currency: "USD",
        range: "7d",
        includeSparkline: false,
        apiKey: null,
      }),
    ).rejects.toMatchObject({ code: "not_configured" });
  });
});
