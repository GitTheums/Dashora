import { z } from "zod";

export const marketAssetClassSchema = z.enum(["crypto", "equity", "index"]);
export type MarketAssetClass = z.infer<typeof marketAssetClassSchema>;

export const marketLayoutSchema = z.enum(["compact", "cards"]);
export type MarketLayout = z.infer<typeof marketLayoutSchema>;

export const marketRangeSchema = z.enum(["1d", "7d", "30d", "90d", "1y"]);
export type MarketRange = z.infer<typeof marketRangeSchema>;

export const marketStateSchema = z.enum(["open", "closed", "unknown"]);
export type MarketState = z.infer<typeof marketStateSchema>;

const symbolTickerSchema = z
  .string()
  .trim()
  .min(1)
  .max(24)
  .transform((value) => value.toUpperCase());

export const marketSymbolConfigSchema = z.object({
  id: z.string().uuid(),
  /** Display ticker (e.g. BTC, AAPL, SPX). */
  symbol: symbolTickerSchema,
  assetClass: marketAssetClassSchema,
  /** Optional display name override. */
  label: z.string().trim().max(80).optional().default(""),
  /**
   * Provider-specific identifier when it differs from the ticker
   * (e.g. CoinGecko id `bitcoin` for BTC).
   */
  providerSymbol: z.string().trim().min(1).max(64).optional(),
});

export type MarketSymbolConfig = z.infer<typeof marketSymbolConfigSchema>;

export const marketsConfigSchema = z.object({
  symbols: z.array(marketSymbolConfigSchema).max(20).default([]),
  currency: z
    .string()
    .trim()
    .min(3)
    .max(8)
    .transform((value) => value.toUpperCase())
    .default("USD"),
  layout: marketLayoutSchema.default("compact"),
  range: marketRangeSchema.default("7d"),
  showRangeSelector: z.boolean().default(true),
  showSparkline: z.boolean().default(true),
  showAbsoluteChange: z.boolean().default(true),
  enabled: z.boolean().default(true),
});

export type MarketsConfig = z.infer<typeof marketsConfigSchema>;

export const MARKETS_DEFAULT_CONFIG: MarketsConfig = marketsConfigSchema.parse({});

export const marketQuoteSchema = z.object({
  id: z.string().uuid(),
  symbol: z.string().min(1).max(24),
  name: z.string().min(1).max(120),
  assetClass: marketAssetClassSchema,
  price: z.number().finite(),
  changeAbsolute: z.number().finite(),
  changePercent: z.number().finite(),
  currency: z.string().min(3).max(8),
  sparkline: z.array(z.number().finite()).max(64),
  marketState: marketStateSchema,
  asOf: z.string().datetime({ offset: true }),
  providerId: z.string().min(1).max(64),
  status: z.enum(["ok", "error"]),
  message: z.string().max(240).optional(),
});

export type MarketQuote = z.infer<typeof marketQuoteSchema>;

export const marketsDataSchema = z.object({
  layout: marketLayoutSchema,
  range: marketRangeSchema,
  showRangeSelector: z.boolean(),
  showSparkline: z.boolean(),
  showAbsoluteChange: z.boolean(),
  currency: z.string().min(3).max(8),
  quotes: z.array(marketQuoteSchema).max(20),
  fetchedAt: z.string().datetime({ offset: true }),
  providers: z.array(z.string().min(1).max(64)).max(8),
});

export type MarketsData = z.infer<typeof marketsDataSchema>;

export function isMarketsConfigured(config: MarketsConfig): boolean {
  return config.symbols.length > 0;
}

export function symbolsNeedingCrypto(config: MarketsConfig): MarketSymbolConfig[] {
  return config.symbols.filter((symbol) => symbol.assetClass === "crypto");
}

export function symbolsNeedingEquities(config: MarketsConfig): MarketSymbolConfig[] {
  return config.symbols.filter(
    (symbol) => symbol.assetClass === "equity" || symbol.assetClass === "index",
  );
}
