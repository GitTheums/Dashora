import { describe, expect, it } from "vitest";
import { createTestServerEnv } from "../../test/env.js";
import { createProviderPlatform } from "../platform.js";
import { isAllowedHttpsHostname } from "../url-allowlist.js";
import { createCoinGeckoCryptoAdapter, resolveCoinGeckoApiKeyHeaderName } from "./coingecko.js";

describe("CoinGecko API key header host selection", () => {
  it("uses the pro header only for the exact pro hostname", () => {
    expect(resolveCoinGeckoApiKeyHeaderName("https://pro-api.coingecko.com/api/v3")).toBe(
      "x-cg-pro-api-key",
    );
    expect(resolveCoinGeckoApiKeyHeaderName("https://api.coingecko.com/api/v3")).toBe(
      "x-cg-demo-api-key",
    );
    expect(resolveCoinGeckoApiKeyHeaderName("https://API.COINGECKO.COM/api/v3")).toBe(
      "x-cg-demo-api-key",
    );
  });

  it("does not treat deceptive hosts as CoinGecko pro", () => {
    expect(
      resolveCoinGeckoApiKeyHeaderName("https://pro-api.coingecko.com.attacker.example/api/v3"),
    ).toBe("x-cg-demo-api-key");
    expect(resolveCoinGeckoApiKeyHeaderName("https://attacker-pro-api.coingecko.com/api/v3")).toBe(
      "x-cg-demo-api-key",
    );
    expect(resolveCoinGeckoApiKeyHeaderName("https://user:pass@pro-api.coingecko.com/api/v3")).toBe(
      "x-cg-demo-api-key",
    );
    expect(resolveCoinGeckoApiKeyHeaderName("http://pro-api.coingecko.com/api/v3")).toBe(
      "x-cg-demo-api-key",
    );
    expect(resolveCoinGeckoApiKeyHeaderName("https://pro-api.coingecko.com:8443/api/v3")).toBe(
      "x-cg-demo-api-key",
    );
  });

  it("sends the demo key header for the public API in a fetch", async () => {
    let seenAuthHeader: string | null = null;
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      expect(isAllowedHttpsHostname(url, ["api.coingecko.com"])).toBe(true);
      const headers = new Headers(init?.headers);
      seenAuthHeader = headers.get("x-cg-demo-api-key") ?? headers.get("x-cg-pro-api-key") ?? null;
      return new Response(
        JSON.stringify({
          bitcoin: { usd: 100, usd_24h_change: 1, last_updated_at: 1_700_000_000 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };

    const platform = createProviderPlatform({
      env: createTestServerEnv({ COINGECKO_API_KEY: "CG-test-key" }),
      fetchImpl,
    });
    const adapter = createCoinGeckoCryptoAdapter({ platform });
    const result = await adapter.fetchQuotes({
      apiKey: "CG-test-key",
      currency: "usd",
      range: "7d",
      includeSparkline: false,
      symbols: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          symbol: "BTC",
          assetClass: "crypto",
          label: "Bitcoin",
          resolvedProviderSymbol: "bitcoin",
        },
      ],
      now: new Date("2026-07-30T12:00:00.000Z"),
    });

    expect(seenAuthHeader).toBe("CG-test-key");
    expect(result.quotes).toHaveLength(1);
    expect(result.quotes[0]?.price).toBe(100);
  });
});
