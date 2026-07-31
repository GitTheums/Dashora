import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

export type VirtualListProps<T> = {
  items: readonly T[];
  /** Estimated row height in CSS pixels. */
  estimateSize: number;
  /** Extra rows rendered above/below the viewport. */
  overscan?: number;
  /** Minimum item count before virtualization engages. */
  threshold?: number;
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  style?: CSSProperties;
  role?: string;
  "aria-label"?: string;
};

/** Default item count before a feed list switches to windowed rendering. */
export const VIRTUAL_LIST_THRESHOLD = 24;

/**
 * Lightweight fixed-estimate virtualizer for long in-widget lists.
 * Below `threshold`, items render normally to avoid layout overhead.
 */
export function VirtualList<T>({
  items,
  estimateSize,
  overscan = 4,
  threshold = VIRTUAL_LIST_THRESHOLD,
  getKey,
  renderItem,
  className,
  style,
  role = "list",
  "aria-label": ariaLabel,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  useEffect(() => {
    const node = parentRef.current;
    if (!node || items.length < threshold) {
      return;
    }
    const onScroll = () => {
      setScrollTop(node.scrollTop);
    };
    setViewportHeight(node.clientHeight);
    node.addEventListener("scroll", onScroll, { passive: true });
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          setViewportHeight(entry.contentRect.height);
        }
      });
      observer.observe(node);
    }
    return () => {
      observer?.disconnect();
      node.removeEventListener("scroll", onScroll);
    };
  }, [items.length, threshold]);

  if (items.length < threshold) {
    return (
      <div className={className} style={style} role={role} aria-label={ariaLabel}>
        {items.map((item, index) => (
          <div key={getKey(item, index)} role={role === "list" ? "listitem" : undefined}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    );
  }

  const totalHeight = items.length * estimateSize;
  const startIndex = Math.max(0, Math.floor(scrollTop / estimateSize) - overscan);
  const visibleCount =
    Math.ceil((viewportHeight || estimateSize * 8) / estimateSize) + overscan * 2;
  const endIndex = Math.min(items.length, startIndex + visibleCount);
  const offsetY = startIndex * estimateSize;

  return (
    <div
      ref={parentRef}
      className={className}
      role={role}
      aria-label={ariaLabel}
      style={{
        height: "100%",
        minHeight: estimateSize * 6,
        overflow: "auto",
        position: "relative",
        ...style,
      }}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {items.slice(startIndex, endIndex).map((item, offset) => {
            const index = startIndex + offset;
            return (
              <div
                key={getKey(item, index)}
                role={role === "list" ? "listitem" : undefined}
                style={{ minHeight: estimateSize }}
              >
                {renderItem(item, index)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
