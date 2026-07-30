import { cx } from "@dashora/ui";

export type SparklineProps = {
  values: number[];
  tone?: "up" | "down" | "neutral";
  className?: string;
};

export function Sparkline({ values, tone = "neutral", className }: SparklineProps) {
  if (values.length < 2) {
    return null;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
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
      className={cx("microchart", `microchart--${tone}`, className)}
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
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

export type BarChartProps = {
  values: Array<{ label: string; value: number }>;
  activeIndex?: number;
  className?: string;
  unit?: string;
};

export function BarChart({ values, activeIndex, className, unit = "°" }: BarChartProps) {
  if (values.length === 0) {
    return null;
  }

  const max = Math.max(...values.map((item) => item.value));
  const min = Math.min(...values.map((item) => item.value));
  const range = Math.max(max - min, 1);

  return (
    <div className={cx("microbars", className)} role="img" aria-label="Hourly temperature trend">
      {values.map((item, index) => {
        const heightPct = 28 + ((item.value - min) / range) * 72;
        const active = index === activeIndex;
        return (
          <div
            key={item.label}
            className={cx("microbars__item", active && "microbars__item--active")}
          >
            <div className="microbars__track" aria-hidden="true">
              <span className="microbars__bar" style={{ height: `${heightPct}%` }} />
            </div>
            <span className="microbars__value">
              {item.value}
              {unit}
            </span>
            <span className="microbars__label">{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
