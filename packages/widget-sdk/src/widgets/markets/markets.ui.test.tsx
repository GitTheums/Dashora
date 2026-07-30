import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { REQUIRED_WIDGET_STATES } from "../../states.js";
import type { MarketsClient } from "./client.js";
import { MARKETS_DEFAULT_CONFIG, type MarketsData } from "./config.js";
import { MarketsRenderer } from "./renderer.js";
import { MarketsSettings } from "./settings.js";

const sampleData: MarketsData = {
  layout: "compact",
  range: "7d",
  showRangeSelector: true,
  showSparkline: true,
  showAbsoluteChange: true,
  currency: "USD",
  quotes: [
    {
      id: "11111111-1111-4111-8111-111111111101",
      symbol: "BTC",
      name: "Bitcoin",
      assetClass: "crypto",
      price: 64_250.12,
      changeAbsolute: 1210.5,
      changePercent: 1.92,
      currency: "USD",
      sparkline: [62_000, 63_000, 62_800, 64_250],
      marketState: "open",
      asOf: "2026-07-30T12:00:00.000Z",
      providerId: "coingecko",
      status: "ok",
    },
    {
      id: "11111111-1111-4111-8111-111111111102",
      symbol: "AAPL",
      name: "Apple",
      assetClass: "equity",
      price: 214.35,
      changeAbsolute: -1.25,
      changePercent: -0.58,
      currency: "USD",
      sparkline: [216, 215.5, 214.8, 214.35],
      marketState: "closed",
      asOf: "2026-07-30T12:00:00.000Z",
      providerId: "finnhub",
      status: "ok",
    },
  ],
  fetchedAt: "2026-07-30T12:00:00.000Z",
  providers: ["coingecko", "finnhub"],
};

const configuredConfig = {
  ...MARKETS_DEFAULT_CONFIG,
  symbols: [
    {
      id: "11111111-1111-4111-8111-111111111101",
      symbol: "BTC",
      assetClass: "crypto" as const,
      label: "Bitcoin",
    },
  ],
};

afterEach(() => {
  cleanup();
});

describe("MarketsRenderer", () => {
  it.each(REQUIRED_WIDGET_STATES)("renders state=%s", (state) => {
    render(
      <MarketsRenderer
        instanceId="1"
        title="Markets"
        config={configuredConfig}
        state={state}
        {...(state === "success" || state === "empty" || state === "stale" || state === "refreshing"
          ? { data: sampleData }
          : {})}
        message={`msg-${state}`}
      />,
    );
    expect(document.querySelector(`[data-widget="markets"][data-state="${state}"]`)).toBeTruthy();
  });

  it("renders compact watchlist with closed indicator", () => {
    render(
      <MarketsRenderer
        instanceId="1"
        title="Markets"
        config={configuredConfig}
        state="success"
        data={sampleData}
      />,
    );
    expect(screen.getByText("BTC")).toBeTruthy();
    expect(screen.getByText("AAPL")).toBeTruthy();
    expect(screen.getByText("Closed")).toBeTruthy();
    expect(screen.getByText("+1.92%")).toBeTruthy();
    expect(screen.getByText("-0.58%")).toBeTruthy();
  });

  it("renders cards layout", () => {
    render(
      <MarketsRenderer
        instanceId="1"
        title="Markets"
        config={{ ...configuredConfig, layout: "cards" }}
        state="success"
        data={{ ...sampleData, layout: "cards" }}
      />,
    );
    expect(screen.getByText("Bitcoin")).toBeTruthy();
    expect(screen.getAllByText(/As of/).length).toBeGreaterThan(0);
  });
});

describe("MarketsSettings", () => {
  it("renders watchlist controls and provider guidance", () => {
    const client: MarketsClient = {
      fetchData: vi.fn(),
    };
    void client;
    render(
      <MarketsSettings instanceId="1" config={MARKETS_DEFAULT_CONFIG} onChange={() => undefined} />,
    );
    expect(screen.getByText(/COINGECKO_API_KEY/)).toBeTruthy();
    expect(screen.getByText(/FINNHUB_API_KEY/)).toBeTruthy();
    expect(screen.getByLabelText("Currency")).toBeTruthy();
    expect(screen.getByLabelText("Layout")).toBeTruthy();
  });
});
