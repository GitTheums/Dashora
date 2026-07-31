import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VIRTUAL_LIST_THRESHOLD, VirtualList } from "./virtual-list.js";

describe("VirtualList", () => {
  beforeEach(() => {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders all items below the virtualization threshold", () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: `i-${i}`, label: `Item ${i}` }));
    render(
      <VirtualList
        items={items}
        estimateSize={40}
        threshold={VIRTUAL_LIST_THRESHOLD}
        getKey={(item) => item.id}
        renderItem={(item) => <span>{item.label}</span>}
      />,
    );
    expect(screen.getByText("Item 0")).toBeTruthy();
    expect(screen.getByText("Item 9")).toBeTruthy();
  });

  it("virtualizes long lists and keeps total height for the scroll range", () => {
    const items = Array.from({ length: 80 }, (_, i) => ({ id: `i-${i}`, label: `Row ${i}` }));
    const { container } = render(
      <VirtualList
        items={items}
        estimateSize={32}
        threshold={24}
        getKey={(item) => item.id}
        renderItem={(item) => <span>{item.label}</span>}
        style={{ height: 160 }}
      />,
    );
    const spacer = container.querySelector('[style*="height: 2560px"]');
    expect(spacer).toBeTruthy();
    expect(screen.getByText("Row 0")).toBeTruthy();
    expect(screen.queryByText("Row 79")).toBeNull();
  });
});
