import { describe, expect, it } from "vitest";
import {
  LAYOUT_COLS,
  type LayoutItem,
  addWidgetToLayout,
  clampItemToCols,
  convertLayoutBetweenBreakpoints,
  createDefaultPageLayout,
  createEmptyPageLayout,
  createPageWidgetRequestSchema,
  createPageWidgetResponseSchema,
  duplicateWidgetInLayout,
  findCollisions,
  findOpenSlot,
  hasCollisions,
  isPlaceholderWidget,
  isTypedWidgetInstance,
  itemsCollide,
  layoutsEqual,
  moveLayoutItem,
  parsePageLayout,
  removeWidgetFromLayout,
  resolveBreakpoint,
  serializePageLayout,
  typedWidgetInstanceSchema,
  updateWidgetInLayout,
} from "./layout.js";
import { createDashoraUuid } from "./uuid.js";

function box(i: string, x: number, y: number, w: number, h: number): LayoutItem {
  return { i, x, y, w, h, minW: 1, minH: 1 };
}

describe("layout serialization", () => {
  it("round-trips the default page layout", () => {
    const document = createDefaultPageLayout();
    const serialized = serializePageLayout(document);
    const parsed = parsePageLayout(serialized);
    expect(layoutsEqual(document, parsed)).toBe(true);
    expect(parsed.widgets).toHaveLength(8);
    expect(parsed.layouts.lg).toHaveLength(8);
  });

  it("rejects overlapping items", () => {
    const document = createDefaultPageLayout();
    const first = document.widgets[0];
    const second = document.widgets[1];
    expect(first && second).toBeTruthy();
    if (!first || !second) {
      return;
    }
    document.layouts.lg[0] = box(first.id, 0, 0, 4, 2);
    document.layouts.lg[1] = box(second.id, 2, 0, 4, 2);
    expect(() => parsePageLayout(document)).toThrow(/Overlap|overlap|Overlapping/i);
  });

  it("rejects items that exceed breakpoint columns", () => {
    const document = createDefaultPageLayout();
    const current = document.layouts.sm[0];
    expect(current).toBeTruthy();
    if (!current) {
      return;
    }
    document.layouts.sm[0] = {
      ...current,
      x: 2,
      w: 4,
      maxW: 4,
    };
    expect(() => parsePageLayout(document)).toThrow(/exceeds 4 columns/i);
  });
});

describe("breakpoint conversion", () => {
  it("scales a 12-column layout into 4 columns and clears collisions", () => {
    const source = [box("a", 0, 0, 6, 2), box("b", 6, 0, 6, 2), box("c", 0, 2, 12, 1)];
    const converted = convertLayoutBetweenBreakpoints(source, LAYOUT_COLS.lg, LAYOUT_COLS.sm);
    expect(converted.every((item) => item.x + item.w <= LAYOUT_COLS.sm)).toBe(true);
    expect(hasCollisions(converted)).toBe(false);
    expect(converted.map((item) => item.i).sort()).toEqual(["a", "b", "c"]);
  });

  it("resolves breakpoint names from width", () => {
    expect(resolveBreakpoint(1400)).toBe("lg");
    expect(resolveBreakpoint(900)).toBe("md");
    expect(resolveBreakpoint(320)).toBe("sm");
  });

  it("clamps max width to available columns", () => {
    const clamped = clampItemToCols(box("a", 0, 0, 8, 2), LAYOUT_COLS.sm);
    expect(clamped.w).toBeLessThanOrEqual(LAYOUT_COLS.sm);
    expect(clamped.x + clamped.w).toBeLessThanOrEqual(LAYOUT_COLS.sm);
  });
});

describe("collision handling", () => {
  it("detects overlapping rectangles", () => {
    expect(itemsCollide(box("a", 0, 0, 2, 2), box("b", 1, 1, 2, 2))).toBe(true);
    expect(itemsCollide(box("a", 0, 0, 2, 2), box("b", 2, 0, 2, 2))).toBe(false);
    expect(findCollisions([box("a", 0, 0, 3, 1), box("b", 2, 0, 2, 1)])).toEqual([["a", "b"]]);
  });

  it("moves items with keyboard-style deltas and avoids overlaps", () => {
    const layout = [box("a", 0, 0, 2, 1), box("b", 2, 0, 2, 1)];
    const moved = moveLayoutItem(layout, "a", 1, 0, 8);
    expect(hasCollisions(moved)).toBe(false);
    const a = moved.find((item) => item.i === "a");
    expect(a?.x).toBeGreaterThanOrEqual(0);
  });
});

describe("page widget union", () => {
  it("accepts legacy placeholders without kind", () => {
    const document = createDefaultPageLayout();
    const legacy = {
      version: 1 as const,
      widgets: document.widgets.map(({ kind: _kind, ...rest }) => rest),
      layouts: document.layouts,
    };
    const parsed = parsePageLayout(legacy);
    expect(parsed.widgets.every((widget) => isPlaceholderWidget(widget))).toBe(true);
    expect(parsed.widgets[0]?.kind).toBe("placeholder");
  });

  it("allows an empty page layout", () => {
    const empty = createEmptyPageLayout();
    expect(empty.widgets).toEqual([]);
    expect(empty.layouts.lg).toEqual([]);
  });

  it("adds, duplicates, updates, and removes typed widgets", () => {
    let document = createEmptyPageLayout();
    const widgetId = "b1111111-1111-4111-8111-111111111101";
    document = addWidgetToLayout(
      document,
      {
        kind: "widget",
        id: widgetId,
        type: "clock",
        title: "Clock",
        enabled: true,
        config: { timezone: "UTC" },
        schemaVersion: 1,
        lastUpdatedAt: null,
      },
      { colSpan: 4, rowSpan: 2, tabletColSpan: 4, mobileColSpan: 4 },
    );
    expect(document.widgets).toHaveLength(1);
    expect(document.layouts.lg).toHaveLength(1);
    const first = document.widgets[0];
    expect(first).toBeTruthy();
    if (!first) {
      return;
    }
    expect(isTypedWidgetInstance(first)).toBe(true);

    const duplicateId = "b1111111-1111-4111-8111-111111111102";
    document = duplicateWidgetInLayout(document, widgetId, duplicateId);
    expect(document.widgets).toHaveLength(2);
    expect(document.layouts.md).toHaveLength(2);
    expect(hasCollisions(document.layouts.lg)).toBe(false);

    document = updateWidgetInLayout(document, widgetId, (widget) => ({
      ...widget,
      title: "Renamed",
      enabled: false,
    }));
    expect(document.widgets.find((entry) => entry.id === widgetId)?.title).toBe("Renamed");
    expect(document.widgets.find((entry) => entry.id === widgetId)?.enabled).toBe(false);

    document = removeWidgetFromLayout(document, widgetId);
    expect(document.widgets.map((entry) => entry.id)).toEqual([duplicateId]);
    expect(document.layouts.sm.every((entry) => entry.i === duplicateId)).toBe(true);
  });

  it("finds an open slot below existing items when the first row is full", () => {
    const layout = [box("a", 0, 0, 4, 2), box("b", 4, 0, 4, 2), box("c", 8, 0, 4, 2)];
    const slot = findOpenSlot(layout, 12, 4, 2);
    expect(slot.y).toBeGreaterThanOrEqual(2);
    expect(slot.x + 4).toBeLessThanOrEqual(12);
  });

  it("rejects typed widgets that use the type slug as the instance id", () => {
    const result = typedWidgetInstanceSchema.safeParse({
      kind: "widget",
      id: "weather",
      type: "weather",
      title: "Weather",
      enabled: true,
      config: {},
      schemaVersion: 1,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["id"]);
    }
  });
});

describe("create page widget schemas", () => {
  it("accepts create requests without a persistent widget id", () => {
    const weather = createPageWidgetRequestSchema.parse({
      kind: "widget",
      type: "weather",
      title: "Weather",
      config: {},
      schemaVersion: 1,
      defaultLayout: { colSpan: 4, rowSpan: 2 },
    });
    expect(weather).not.toHaveProperty("id");
    expect(weather.kind).toBe("widget");
    if (weather.kind === "widget") {
      expect(weather.type).toBe("weather");
    }

    const rss = createPageWidgetRequestSchema.parse({
      kind: "widget",
      type: "rss",
      defaultLayout: { colSpan: 4, rowSpan: 3 },
    });
    expect(rss).not.toHaveProperty("id");
    expect(rss.kind).toBe("widget");
    if (rss.kind === "widget") {
      expect(rss.type).toBe("rss");
    }
  });

  it("accepts a server response with distinct UUID instance ids", () => {
    const weatherId = createDashoraUuid();
    const rssId = createDashoraUuid();
    expect(weatherId).not.toBe(rssId);

    let document = createEmptyPageLayout();
    document = addWidgetToLayout(
      document,
      {
        kind: "widget",
        id: weatherId,
        type: "weather",
        title: "Weather",
        enabled: true,
        config: {},
        schemaVersion: 1,
        lastUpdatedAt: null,
      },
      { colSpan: 4, rowSpan: 2 },
    );
    document = addWidgetToLayout(
      document,
      {
        kind: "widget",
        id: rssId,
        type: "rss",
        title: "RSS",
        enabled: true,
        config: { feeds: [] },
        schemaVersion: 1,
        lastUpdatedAt: null,
      },
      { colSpan: 4, rowSpan: 3 },
    );

    const weather = document.widgets.find((widget) => widget.id === weatherId);
    const rss = document.widgets.find((widget) => widget.id === rssId);
    expect(weather?.kind === "widget" && weather.type).toBe("weather");
    expect(rss?.kind === "widget" && rss.type).toBe("rss");
    expect(weatherId).not.toBe("weather");
    expect(rssId).not.toBe("rss");

    const pageId = createDashoraUuid();
    const response = createPageWidgetResponseSchema.parse({
      pageId,
      widget: weather,
      layout: document,
      updatedAt: Date.now(),
    });
    expect(response.widget.id).toBe(weatherId);
  });
});
