import { cx } from "@dashora/ui";
import { Sparkline } from "../microcharts.js";
import { mockMarkets } from "../mock-data.js";
import { WidgetShell } from "../widget-shell.js";

export function MarketsWidget() {
  return (
    <WidgetShell
      title="Markets"
      description="Watchlist"
      variant="dense"
      colSpan={3}
      tabletSpan={4}
      mobileSpan={2}
    >
      <ul className="markets-list">
        {mockMarkets.map((item) => {
          const up = item.changePct >= 0;
          return (
            <li key={item.symbol} className="markets-list__item">
              <div className="markets-list__identity">
                <span className="markets-list__symbol meta-value">{item.symbol}</span>
                <span className="list-meta">{item.name}</span>
              </div>
              <Sparkline
                values={item.sparkline}
                tone={up ? "up" : "down"}
                className="markets-list__spark"
              />
              <div className="markets-list__quote">
                <span className="meta-value">{item.price}</span>
                <span className={cx("markets-list__change", up ? "is-up" : "is-down")}>
                  {up ? "+" : ""}
                  {item.changePct.toFixed(2)}%
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </WidgetShell>
  );
}
