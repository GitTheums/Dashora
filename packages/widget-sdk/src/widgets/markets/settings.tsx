import { type FormEvent, useId, useState } from "react";
import type { WidgetSettingsProps } from "../../registry/types.js";
import {
  widgetFieldStyle,
  widgetInputStyle,
  widgetLabelStyle,
  widgetMutedStyle,
} from "../_shared/chrome.js";
import {
  type MarketAssetClass,
  type MarketLayout,
  type MarketRange,
  type MarketSymbolConfig,
  type MarketsConfig,
  marketsConfigSchema,
} from "./config.js";

export type MarketsSettingsProps = WidgetSettingsProps<MarketsConfig>;

function newSymbolId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `00000000-0000-4000-8000-${Date.now().toString(16).padStart(12, "0")}`.slice(0, 36);
}

const ASSET_OPTIONS: Array<{ value: MarketAssetClass; label: string }> = [
  { value: "crypto", label: "Crypto" },
  { value: "equity", label: "Equity" },
  { value: "index", label: "Index" },
];

const RANGE_OPTIONS: Array<{ value: MarketRange; label: string }> = [
  { value: "1d", label: "1 day" },
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "1y", label: "1 year" },
];

export function MarketsSettings({
  config,
  onChange,
  onSubmit,
  disabled = false,
}: MarketsSettingsProps) {
  const currencyId = useId();
  const layoutId = useId();
  const rangeId = useId();
  const [draftSymbol, setDraftSymbol] = useState("");
  const [draftAssetClass, setDraftAssetClass] = useState<MarketAssetClass>("crypto");
  const [draftLabel, setDraftLabel] = useState("");
  const [draftProviderSymbol, setDraftProviderSymbol] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit?.(marketsConfigSchema.parse(config));
  };

  const addSymbol = () => {
    const symbol = draftSymbol.trim().toUpperCase();
    if (!symbol) {
      setFormError("Enter a ticker symbol.");
      return;
    }
    if (config.symbols.length >= 20) {
      setFormError("Watchlist is limited to 20 symbols.");
      return;
    }
    if (
      config.symbols.some((item) => item.symbol === symbol && item.assetClass === draftAssetClass)
    ) {
      setFormError("That symbol is already on the watchlist.");
      return;
    }
    const next: MarketSymbolConfig = {
      id: newSymbolId(),
      symbol,
      assetClass: draftAssetClass,
      label: draftLabel.trim(),
      ...(draftProviderSymbol.trim() ? { providerSymbol: draftProviderSymbol.trim() } : {}),
    };
    onChange({ ...config, symbols: [...config.symbols, next] });
    setDraftSymbol("");
    setDraftLabel("");
    setDraftProviderSymbol("");
    setFormError(null);
  };

  const removeSymbol = (id: string) => {
    onChange({ ...config, symbols: config.symbols.filter((item) => item.id !== id) });
  };

  const moveSymbol = (id: string, direction: -1 | 1) => {
    const index = config.symbols.findIndex((item) => item.id === id);
    if (index < 0) {
      return;
    }
    const target = index + direction;
    if (target < 0 || target >= config.symbols.length) {
      return;
    }
    const next = [...config.symbols];
    const [item] = next.splice(index, 1);
    if (!item) {
      return;
    }
    next.splice(target, 0, item);
    onChange({ ...config, symbols: next });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <p style={widgetMutedStyle}>
        Provider API keys stay on the server. Set <code>COINGECKO_API_KEY</code> for crypto and{" "}
        <code>FINNHUB_API_KEY</code> for equities and indexes. Without the matching key, this widget
        shows a configuration-required state instead of failing silently.
      </p>

      <fieldset
        disabled={disabled}
        style={{ border: "none", margin: 0, padding: 0, display: "grid", gap: "0.65rem" }}
      >
        <legend style={{ ...widgetLabelStyle, marginBottom: "0.25rem" }}>Add symbol</legend>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
          <label style={widgetFieldStyle}>
            <span style={widgetLabelStyle}>Ticker</span>
            <input
              style={widgetInputStyle}
              value={draftSymbol}
              onChange={(event) => setDraftSymbol(event.target.value)}
              placeholder="BTC or AAPL"
              maxLength={24}
              autoComplete="off"
            />
          </label>
          <label style={widgetFieldStyle}>
            <span style={widgetLabelStyle}>Asset class</span>
            <select
              style={widgetInputStyle}
              value={draftAssetClass}
              onChange={(event) => setDraftAssetClass(event.target.value as MarketAssetClass)}
            >
              {ASSET_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label style={widgetFieldStyle}>
          <span style={widgetLabelStyle}>Display name (optional)</span>
          <input
            style={widgetInputStyle}
            value={draftLabel}
            onChange={(event) => setDraftLabel(event.target.value)}
            placeholder="Bitcoin"
            maxLength={80}
          />
        </label>
        <label style={widgetFieldStyle}>
          <span style={widgetLabelStyle}>Provider symbol override (optional)</span>
          <input
            style={widgetInputStyle}
            value={draftProviderSymbol}
            onChange={(event) => setDraftProviderSymbol(event.target.value)}
            placeholder={draftAssetClass === "crypto" ? "bitcoin" : "AAPL"}
            maxLength={64}
          />
        </label>
        {formError ? (
          <p style={{ ...widgetMutedStyle, color: "var(--ds-danger, #c43c3c)" }} role="alert">
            {formError}
          </p>
        ) : null}
        <button type="button" onClick={addSymbol}>
          Add to watchlist
        </button>
      </fieldset>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <p style={{ ...widgetLabelStyle, margin: 0 }}>Watchlist ({config.symbols.length}/20)</p>
        {config.symbols.length === 0 ? (
          <p style={widgetMutedStyle}>No symbols yet. Add tickers above.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "0.35rem" }}>
            {config.symbols.map((symbol, index) => (
              <li
                key={symbol.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: "0.5rem",
                  alignItems: "center",
                  padding: "0.45rem 0.55rem",
                  borderRadius: "var(--ds-radius-md, 0.5rem)",
                  background: "var(--ds-surface-2, #f3f6f8)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>
                    {symbol.symbol}{" "}
                    <span style={{ ...widgetMutedStyle, fontWeight: 500 }}>
                      ({symbol.assetClass})
                    </span>
                  </p>
                  {symbol.label ? <p style={widgetMutedStyle}>{symbol.label}</p> : null}
                </div>
                <div style={{ display: "flex", gap: "0.25rem" }}>
                  <button
                    type="button"
                    aria-label={`Move ${symbol.symbol} up`}
                    disabled={disabled || index === 0}
                    onClick={() => moveSymbol(symbol.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${symbol.symbol} down`}
                    disabled={disabled || index === config.symbols.length - 1}
                    onClick={() => moveSymbol(symbol.id, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${symbol.symbol}`}
                    disabled={disabled}
                    onClick={() => removeSymbol(symbol.id)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <label style={widgetFieldStyle} htmlFor={currencyId}>
        <span style={widgetLabelStyle}>Currency</span>
        <input
          id={currencyId}
          style={widgetInputStyle}
          value={config.currency}
          disabled={disabled}
          maxLength={8}
          onChange={(event) =>
            onChange({ ...config, currency: event.target.value.toUpperCase() || "USD" })
          }
        />
      </label>

      <label style={widgetFieldStyle} htmlFor={layoutId}>
        <span style={widgetLabelStyle}>Layout</span>
        <select
          id={layoutId}
          style={widgetInputStyle}
          value={config.layout}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, layout: event.target.value as MarketLayout })}
        >
          <option value="compact">Compact list</option>
          <option value="cards">Larger cards</option>
        </select>
      </label>

      <label style={widgetFieldStyle} htmlFor={rangeId}>
        <span style={widgetLabelStyle}>Default sparkline range</span>
        <select
          id={rangeId}
          style={widgetInputStyle}
          value={config.range}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, range: event.target.value as MarketRange })}
        >
          {RANGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input
          type="checkbox"
          checked={config.showRangeSelector}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, showRangeSelector: event.target.checked })}
        />
        <span style={widgetLabelStyle}>Show range selector</span>
      </label>

      <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input
          type="checkbox"
          checked={config.showSparkline}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, showSparkline: event.target.checked })}
        />
        <span style={widgetLabelStyle}>Show sparklines</span>
      </label>

      <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input
          type="checkbox"
          checked={config.showAbsoluteChange}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, showAbsoluteChange: event.target.checked })}
        />
        <span style={widgetLabelStyle}>Show absolute change</span>
      </label>

      <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input
          type="checkbox"
          checked={config.enabled}
          disabled={disabled}
          onChange={(event) => onChange({ ...config, enabled: event.target.checked })}
        />
        <span style={widgetLabelStyle}>Enabled</span>
      </label>

      {onSubmit ? (
        <button type="submit" disabled={disabled}>
          Save
        </button>
      ) : null}
    </form>
  );
}
