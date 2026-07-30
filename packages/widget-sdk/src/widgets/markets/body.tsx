import type { CSSProperties, KeyboardEvent } from "react";
import { useEffect, useId, useState } from "react";
import { widgetMutedStyle, widgetShellStyle } from "../_shared/chrome.js";
import type { MarketsClient } from "./client.js";
import { defaultMarketsClient, parseMarketsEnvelopeData } from "./client.js";
import type {
  MarketLayout,
  MarketQuote,
  MarketRange,
  MarketsConfig,
  MarketsData,
} from "./config.js";
import { marketRangeSchema } from "./config.js";
import {
  formatMarketAbsolute,
  formatMarketAsOf,
  formatMarketPercent,
  formatMarketPrice,
  marketRangeLabel,
  movementTone,
} from "./format.js";

const pulse: CSSProperties = {
  borderRadius: "0.25rem",
  background: "var(--ds-surface-3, #e3e8ed)",
};

const RANGE_OPTIONS: MarketRange[] = ["1d", "7d", "30d", "90d", "1y"];

const upColor = "var(--ds-success, #1f7a4c)";
const downColor = "var(--ds-danger, #c43c3c)";
const mutedColor = "var(--ds-fg-muted, #55606c)";

function toneColor(tone: "up" | "down" | "neutral"): string {
  if (tone === "up") {
    return upColor;
  }
  if (tone === "down") {
    return downColor;
  }
  return mutedColor;
}

export function MarketsSkeleton({ layout = "compact" }: { layout?: MarketLayout }) {
  return (
    <div style={widgetShellStyle} aria-busy="true" aria-live="polite" aria-label="Loading markets">
      {layout === "cards" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(9rem, 1fr))",
            gap: "0.65rem",
          }}
        >
          {["a", "b", "c", "d"].map((id) => (
            <div key={id} style={{ ...pulse, height: "5.5rem" }} />
          ))}
        </div>
      ) : (
        <>
          {["a", "b", "c", "d"].map((id) => (
            <div
              key={id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                gap: "0.75rem",
                alignItems: "center",
              }}
            >
              <div style={{ ...pulse, height: "1.75rem" }} />
              <div style={{ ...pulse, height: "1.25rem", width: "3.5rem" }} />
              <div style={{ ...pulse, height: "1.75rem", width: "4.5rem" }} />
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function Sparkline({
  values,
  tone,
}: {
  values: number[];
  tone: "up" | "down" | "neutral";
}) {
  if (values.length < 2) {
    return null;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, Number.EPSILON);
  const width = 64;
  const height = 24;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
      style={{ color: toneColor(tone), flexShrink: 0 }}
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function MarketClosedBadge() {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "0.1rem 0.35rem",
        borderRadius: "0.25rem",
        background: "var(--ds-surface-3, #e3e8ed)",
        color: mutedColor,
        fontSize: "0.6875rem",
        fontWeight: 600,
        letterSpacing: "0.02em",
        textTransform: "uppercase",
      }}
    >
      Closed
    </span>
  );
}

function QuoteChange({
  quote,
  showAbsolute,
}: {
  quote: MarketQuote;
  showAbsolute: boolean;
}) {
  const tone = movementTone(quote.changePercent);
  return (
    <div style={{ textAlign: "right" }}>
      <p
        style={{
          margin: 0,
          fontSize: "0.8125rem",
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          color: toneColor(tone),
        }}
      >
        {formatMarketPercent(quote.changePercent)}
      </p>
      {showAbsolute ? (
        <p style={{ ...widgetMutedStyle, fontSize: "0.75rem", fontVariantNumeric: "tabular-nums" }}>
          {formatMarketAbsolute(quote.changeAbsolute, quote.currency)}
        </p>
      ) : null}
    </div>
  );
}

function CompactQuoteRow({
  quote,
  showSparkline,
  showAbsoluteChange,
}: {
  quote: MarketQuote;
  showSparkline: boolean;
  showAbsoluteChange: boolean;
}) {
  const tone = movementTone(quote.changePercent);
  const failed = quote.status === "error";

  return (
    <li
      style={{
        display: "grid",
        gridTemplateColumns: showSparkline
          ? "minmax(0, 1fr) auto auto auto"
          : "minmax(0, 1fr) auto auto",
        gap: "0.65rem",
        alignItems: "center",
        padding: "0.35rem 0",
        borderBottom: "1px solid var(--ds-border, rgba(18, 23, 28, 0.1))",
        opacity: failed ? 0.7 : 1,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600, fontSize: "0.875rem" }}>{quote.symbol}</span>
          {quote.marketState === "closed" ? <MarketClosedBadge /> : null}
        </div>
        <p
          style={{
            ...widgetMutedStyle,
            fontSize: "0.75rem",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {failed ? (quote.message ?? "Unavailable") : quote.name}
        </p>
      </div>
      {showSparkline ? <Sparkline values={quote.sparkline} tone={tone} /> : null}
      <p
        style={{
          margin: 0,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          fontSize: "0.875rem",
          textAlign: "right",
        }}
      >
        {failed ? "—" : formatMarketPrice(quote.price, quote.currency)}
      </p>
      {failed ? (
        <span style={{ ...widgetMutedStyle, fontSize: "0.75rem", textAlign: "right" }}>Error</span>
      ) : (
        <QuoteChange quote={quote} showAbsolute={showAbsoluteChange} />
      )}
    </li>
  );
}

function CardQuote({
  quote,
  showSparkline,
  showAbsoluteChange,
}: {
  quote: MarketQuote;
  showSparkline: boolean;
  showAbsoluteChange: boolean;
}) {
  const tone = movementTone(quote.changePercent);
  const failed = quote.status === "error";

  return (
    <article
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.45rem",
        padding: "0.75rem",
        borderRadius: "var(--ds-radius-md, 0.5rem)",
        background: "var(--ds-surface-2, #f3f6f8)",
        border: "1px solid var(--ds-border, rgba(18, 23, 28, 0.1))",
        minWidth: 0,
        opacity: failed ? 0.75 : 1,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: "0.9375rem" }}>{quote.symbol}</span>
            {quote.marketState === "closed" ? <MarketClosedBadge /> : null}
          </div>
          <p style={{ ...widgetMutedStyle, fontSize: "0.75rem" }}>
            {failed ? (quote.message ?? "Unavailable") : quote.name}
          </p>
        </div>
        {showSparkline && !failed ? <Sparkline values={quote.sparkline} tone={tone} /> : null}
      </div>
      <p
        style={{
          margin: 0,
          fontSize: "1.375rem",
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.15,
        }}
      >
        {failed ? "—" : formatMarketPrice(quote.price, quote.currency)}
      </p>
      {failed ? null : <QuoteChange quote={quote} showAbsolute={showAbsoluteChange} />}
      {!failed ? (
        <p style={{ ...widgetMutedStyle, fontSize: "0.6875rem" }}>
          As of {formatMarketAsOf(quote.asOf)}
        </p>
      ) : null}
    </article>
  );
}

function RangeSelector({
  value,
  onChange,
  disabled,
}: {
  value: MarketRange;
  onChange: (range: MarketRange) => void;
  disabled?: boolean;
}) {
  const groupId = useId();

  const onKeyDown = (event: KeyboardEvent<HTMLFieldSetElement>) => {
    const index = RANGE_OPTIONS.indexOf(value);
    if (index < 0) {
      return;
    }
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      const next = RANGE_OPTIONS[(index + 1) % RANGE_OPTIONS.length];
      if (next) {
        onChange(next);
      }
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = RANGE_OPTIONS[(index - 1 + RANGE_OPTIONS.length) % RANGE_OPTIONS.length];
      if (next) {
        onChange(next);
      }
    }
  };

  return (
    <fieldset
      aria-label="Sparkline range"
      id={groupId}
      onKeyDown={onKeyDown}
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "0.25rem",
        margin: 0,
        padding: 0,
        border: "none",
        minInlineSize: 0,
      }}
    >
      <legend
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
        }}
      >
        Sparkline range
      </legend>
      {RANGE_OPTIONS.map((range) => {
        const selected = range === value;
        return (
          <button
            key={range}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(range)}
            style={{
              padding: "0.25rem 0.5rem",
              borderRadius: "0.35rem",
              border: selected
                ? "1px solid var(--ds-border-strong, rgba(18, 23, 28, 0.28))"
                : "1px solid transparent",
              background: selected ? "var(--ds-surface-3, #e3e8ed)" : "transparent",
              color: "var(--ds-fg, inherit)",
              font: "inherit",
              fontSize: "0.75rem",
              fontWeight: selected ? 600 : 500,
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            {marketRangeLabel(range)}
          </button>
        );
      })}
    </fieldset>
  );
}

export type MarketsBodyProps = {
  data: MarketsData;
  config: MarketsConfig;
  instanceId: string;
  client?: MarketsClient;
};

export function MarketsBody({
  data,
  config,
  instanceId,
  client = defaultMarketsClient,
}: MarketsBodyProps) {
  const [displayData, setDisplayData] = useState(data);
  const [range, setRange] = useState<MarketRange>(data.range);
  const [rangeBusy, setRangeBusy] = useState(false);
  const [rangeError, setRangeError] = useState<string | null>(null);

  useEffect(() => {
    setDisplayData(data);
    setRange(data.range);
    setRangeError(null);
  }, [data]);

  useEffect(() => {
    if (range === data.range) {
      setDisplayData(data);
      setRangeBusy(false);
      setRangeError(null);
      return;
    }
    const controller = new AbortController();
    setRangeBusy(true);
    setRangeError(null);
    void (async () => {
      try {
        const envelope = await client.fetchData(
          instanceId,
          { ...config, range },
          { signal: controller.signal },
        );
        if (controller.signal.aborted) {
          return;
        }
        if (envelope.data !== undefined) {
          setDisplayData(parseMarketsEnvelopeData(envelope.data));
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        setRangeError(error instanceof Error ? error.message : "Could not update range.");
      } finally {
        if (!controller.signal.aborted) {
          setRangeBusy(false);
        }
      }
    })();
    return () => {
      controller.abort();
    };
  }, [client, config, data, instanceId, range]);

  const handleRangeChange = (next: MarketRange) => {
    const parsed = marketRangeSchema.safeParse(next);
    if (parsed.success) {
      setRange(parsed.data);
    }
  };

  return (
    <div style={widgetShellStyle}>
      {displayData.showRangeSelector ? (
        <RangeSelector value={range} onChange={handleRangeChange} disabled={rangeBusy} />
      ) : null}
      {rangeError ? (
        <output style={{ ...widgetMutedStyle, color: downColor }}>{rangeError}</output>
      ) : null}
      {rangeBusy ? (
        <p style={widgetMutedStyle} aria-live="polite">
          Updating {marketRangeLabel(range)} range…
        </p>
      ) : null}
      {displayData.layout === "cards" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(9.5rem, 1fr))",
            gap: "0.65rem",
          }}
        >
          {displayData.quotes.map((quote) => (
            <CardQuote
              key={quote.id}
              quote={quote}
              showSparkline={displayData.showSparkline}
              showAbsoluteChange={displayData.showAbsoluteChange}
            />
          ))}
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {displayData.quotes.map((quote) => (
            <CompactQuoteRow
              key={quote.id}
              quote={quote}
              showSparkline={displayData.showSparkline}
              showAbsoluteChange={displayData.showAbsoluteChange}
            />
          ))}
        </ul>
      )}
      <p style={{ ...widgetMutedStyle, fontSize: "0.75rem" }}>
        Updated {formatMarketAsOf(displayData.fetchedAt)}
        {displayData.currency ? ` · ${displayData.currency}` : ""}
      </p>
    </div>
  );
}
