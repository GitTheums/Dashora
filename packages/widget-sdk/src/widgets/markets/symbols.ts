/**
 * Common crypto tickers → CoinGecko coin ids.
 * Unknown tickers fall back to the lowercase ticker or an explicit providerSymbol.
 */
const CRYPTO_PROVIDER_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  ADA: "cardano",
  XRP: "ripple",
  DOGE: "dogecoin",
  DOT: "polkadot",
  AVAX: "avalanche-2",
  MATIC: "matic-network",
  LINK: "chainlink",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  ATOM: "cosmos",
  UNI: "uniswap",
  NEAR: "near",
  APT: "aptos",
  ARB: "arbitrum",
  OP: "optimism",
  SUI: "sui",
  TON: "the-open-network",
};

const CRYPTO_DISPLAY_NAMES: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  SOL: "Solana",
  ADA: "Cardano",
  XRP: "XRP",
  DOGE: "Dogecoin",
  DOT: "Polkadot",
  AVAX: "Avalanche",
  MATIC: "Polygon",
  LINK: "Chainlink",
  LTC: "Litecoin",
  BCH: "Bitcoin Cash",
  ATOM: "Cosmos",
  UNI: "Uniswap",
  NEAR: "NEAR Protocol",
  APT: "Aptos",
  ARB: "Arbitrum",
  OP: "Optimism",
  SUI: "Sui",
  TON: "Toncoin",
};

export function resolveCryptoProviderSymbol(symbol: string, providerSymbol?: string): string {
  if (providerSymbol && providerSymbol.trim().length > 0) {
    return providerSymbol.trim().toLowerCase();
  }
  const mapped = CRYPTO_PROVIDER_IDS[symbol.toUpperCase()];
  if (mapped) {
    return mapped;
  }
  return symbol.trim().toLowerCase();
}

export function resolveEquitiesProviderSymbol(symbol: string, providerSymbol?: string): string {
  if (providerSymbol && providerSymbol.trim().length > 0) {
    return providerSymbol.trim().toUpperCase();
  }
  return symbol.trim().toUpperCase();
}

export function defaultMarketDisplayName(
  symbol: string,
  assetClass: "crypto" | "equity" | "index",
  label?: string,
): string {
  const trimmed = label?.trim();
  if (trimmed) {
    return trimmed;
  }
  if (assetClass === "crypto") {
    return CRYPTO_DISPLAY_NAMES[symbol.toUpperCase()] ?? symbol.toUpperCase();
  }
  return symbol.toUpperCase();
}
