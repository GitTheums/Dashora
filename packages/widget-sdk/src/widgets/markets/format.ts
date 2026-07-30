import type { MarketRange } from "./config.js";

export function formatMarketPrice(value: number, currency: string): string {
  const abs = Math.abs(value);
  const fractionDigits = abs >= 1000 ? 2 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: Math.min(fractionDigits, 2),
      maximumFractionDigits: fractionDigits,
    }).format(value);
  } catch {
    return `${value.toFixed(fractionDigits)} ${currency}`;
  }
}

export function formatMarketPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatMarketAbsolute(value: number, currency: string): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const formatted = formatMarketPrice(Math.abs(value), currency).replace(/^-/, "");
  return `${sign}${formatted}`;
}

export function formatMarketAsOf(iso: string, now = new Date()): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) {
    return "Unknown time";
  }
  const deltaSec = Math.max(0, Math.round((now.getTime() - ms) / 1000));
  if (deltaSec < 60) {
    return "Just now";
  }
  if (deltaSec < 3600) {
    const minutes = Math.floor(deltaSec / 60);
    return `${minutes}m ago`;
  }
  if (deltaSec < 86_400) {
    const hours = Math.floor(deltaSec / 3600);
    return `${hours}h ago`;
  }
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString();
  }
}

export function marketRangeLabel(range: MarketRange): string {
  switch (range) {
    case "1d":
      return "1D";
    case "7d":
      return "7D";
    case "30d":
      return "30D";
    case "90d":
      return "90D";
    case "1y":
      return "1Y";
  }
}

export function movementTone(changePercent: number): "up" | "down" | "neutral" {
  if (changePercent > 0) {
    return "up";
  }
  if (changePercent < 0) {
    return "down";
  }
  return "neutral";
}
