import { z } from "zod";

/** Desktop / tablet / mobile layout breakpoints used by the dashboard grid. */
export const layoutBreakpointSchema = z.enum(["lg", "md", "sm"]);

export type LayoutBreakpoint = z.infer<typeof layoutBreakpointSchema>;

export const LAYOUT_BREAKPOINTS = {
  lg: 1200,
  md: 768,
  sm: 0,
} as const satisfies Record<LayoutBreakpoint, number>;

export const LAYOUT_COLS = {
  lg: 12,
  md: 8,
  sm: 4,
} as const satisfies Record<LayoutBreakpoint, number>;

export const LAYOUT_ROW_HEIGHT = 96;
export const LAYOUT_MARGIN: [number, number] = [16, 16];
export const LAYOUT_SAVE_DEBOUNCE_MS = 500;

/** Minimum widget size on every breakpoint (grid units). */
export const DEFAULT_WIDGET_MIN_W = 2;
export const DEFAULT_WIDGET_MIN_H = 1;

export const layoutItemSchema = z
  .object({
    i: z.string().min(1).max(128),
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    w: z.number().int().min(1),
    h: z.number().int().min(1),
    minW: z.number().int().min(1).optional(),
    minH: z.number().int().min(1).optional(),
    maxW: z.number().int().min(1).optional(),
    maxH: z.number().int().min(1).optional(),
    static: z.boolean().optional(),
  })
  .superRefine((item, ctx) => {
    if (item.maxW !== undefined && item.w > item.maxW) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "w exceeds maxW",
        path: ["w"],
      });
    }
    if (item.maxH !== undefined && item.h > item.maxH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "h exceeds maxH",
        path: ["h"],
      });
    }
    if (item.minW !== undefined && item.w < item.minW) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "w is below minW",
        path: ["w"],
      });
    }
    if (item.minH !== undefined && item.h < item.minH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "h is below minH",
        path: ["h"],
      });
    }
  });

export type LayoutItem = z.infer<typeof layoutItemSchema>;

export const breakpointLayoutsSchema = z.object({
  lg: z.array(layoutItemSchema),
  md: z.array(layoutItemSchema),
  sm: z.array(layoutItemSchema),
});

export type BreakpointLayouts = z.infer<typeof breakpointLayoutsSchema>;

export const placeholderToneSchema = z.enum(["default", "accent", "muted"]);

export type PlaceholderTone = z.infer<typeof placeholderToneSchema>;

/** Grid size hints used when inserting a widget onto a page. */
export const widgetPlacementSizeSchema = z.object({
  colSpan: z.number().int().min(1).max(12),
  rowSpan: z.number().int().min(1).max(24).default(2),
  minColSpan: z.number().int().min(1).max(12).optional(),
  minRowSpan: z.number().int().min(1).max(24).optional(),
  maxColSpan: z.number().int().min(1).max(12).optional(),
  maxRowSpan: z.number().int().min(1).max(24).optional(),
  tabletColSpan: z.number().int().min(1).max(8).optional(),
  mobileColSpan: z.number().int().min(1).max(4).optional(),
});

export type WidgetPlacementSize = z.infer<typeof widgetPlacementSizeSchema>;

export const placeholderWidgetSchema = z.object({
  kind: z.literal("placeholder").default("placeholder"),
  id: z.string().min(1).max(128),
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(240).optional(),
  tone: placeholderToneSchema.default("default"),
  enabled: z.boolean().default(true),
  refreshIntervalSeconds: z.number().int().positive().nullable().optional(),
  lastUpdatedAt: z.number().int().nonnegative().nullable().optional(),
});

export type PlaceholderWidget = z.infer<typeof placeholderWidgetSchema>;

export const typedWidgetInstanceSchema = z.object({
  kind: z.literal("widget"),
  id: z.string().uuid(),
  type: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9-]*$/),
  title: z.string().trim().min(1).max(80),
  enabled: z.boolean().default(true),
  refreshIntervalSeconds: z.number().int().positive().nullable().optional(),
  config: z.record(z.unknown()),
  schemaVersion: z.number().int().min(1),
  lastUpdatedAt: z.number().int().nonnegative().nullable().optional(),
});

export type TypedWidgetInstance = z.infer<typeof typedWidgetInstanceSchema>;

const pageWidgetUnionSchema = z.discriminatedUnion("kind", [
  placeholderWidgetSchema,
  typedWidgetInstanceSchema,
]);

/** Accepts legacy placeholder objects that omit `kind`. */
export const pageWidgetSchema = z.preprocess((raw) => {
  if (raw && typeof raw === "object" && !Array.isArray(raw) && !("kind" in raw)) {
    return { ...raw, kind: "placeholder" };
  }
  return raw;
}, pageWidgetUnionSchema);

export type PageWidget = PlaceholderWidget | TypedWidgetInstance;

export function isPlaceholderWidget(widget: PageWidget): widget is PlaceholderWidget {
  return widget.kind === "placeholder";
}

export function isTypedWidgetInstance(widget: PageWidget): widget is TypedWidgetInstance {
  return widget.kind === "widget";
}

export const pageLayoutDocumentSchema = z
  .object({
    version: z.literal(1),
    widgets: z.array(pageWidgetSchema),
    layouts: breakpointLayoutsSchema,
  })
  .superRefine((doc, ctx) => {
    const ids = new Set(doc.widgets.map((widget) => widget.id));
    if (ids.size !== doc.widgets.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Widget ids must be unique",
        path: ["widgets"],
      });
    }

    for (const breakpoint of layoutBreakpointSchema.options) {
      const cols = LAYOUT_COLS[breakpoint];
      const layout = doc.layouts[breakpoint];
      const layoutIds = new Set(layout.map((item) => item.i));

      if (layoutIds.size !== layout.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate layout item ids at breakpoint ${breakpoint}`,
          path: ["layouts", breakpoint],
        });
      }

      for (const id of ids) {
        if (!layoutIds.has(id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Missing layout for widget ${id} at breakpoint ${breakpoint}`,
            path: ["layouts", breakpoint],
          });
        }
      }

      for (const item of layout) {
        if (!ids.has(item.i)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Unknown widget id ${item.i} at breakpoint ${breakpoint}`,
            path: ["layouts", breakpoint],
          });
        }
        if (item.x + item.w > cols) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Item ${item.i} exceeds ${cols} columns at ${breakpoint}`,
            path: ["layouts", breakpoint],
          });
        }
        if (item.maxW !== undefined && item.maxW > cols) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Item ${item.i} maxW exceeds ${cols} columns at ${breakpoint}`,
            path: ["layouts", breakpoint],
          });
        }
      }

      const collisions = findCollisions(layout);
      if (collisions.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Overlapping items at ${breakpoint}: ${collisions
            .map(([a, b]) => `${a}/${b}`)
            .join(", ")}`,
          path: ["layouts", breakpoint],
        });
      }
    }
  });

export type PageLayoutDocument = z.infer<typeof pageLayoutDocumentSchema>;

export const pageLayoutResponseSchema = z.object({
  pageId: z.string().uuid(),
  layout: pageLayoutDocumentSchema,
  updatedAt: z.number().int().nonnegative(),
  isDefault: z.boolean(),
});

export type PageLayoutResponse = z.infer<typeof pageLayoutResponseSchema>;

export const savePageLayoutRequestSchema = z.object({
  layout: pageLayoutDocumentSchema,
});

export type SavePageLayoutRequest = z.infer<typeof savePageLayoutRequestSchema>;

export const resetPageLayoutResponseSchema = pageLayoutResponseSchema;

export type ResetPageLayoutResponse = z.infer<typeof resetPageLayoutResponseSchema>;

/** Stable placeholder ids so default layouts remain comparable across boots. */
const PLACEHOLDER_IDS = {
  weather: "a1111111-1111-4111-8111-111111111101",
  calendar: "a1111111-1111-4111-8111-111111111102",
  markets: "a1111111-1111-4111-8111-111111111103",
  services: "a1111111-1111-4111-8111-111111111104",
  feed: "a1111111-1111-4111-8111-111111111105",
  notes: "a1111111-1111-4111-8111-111111111106",
  bookmarks: "a1111111-1111-4111-8111-111111111107",
  status: "a1111111-1111-4111-8111-111111111108",
} as const;

function item(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  limits?: Pick<LayoutItem, "minW" | "minH" | "maxW" | "maxH">,
): LayoutItem {
  return {
    i: id,
    x,
    y,
    w,
    h,
    minW: limits?.minW ?? DEFAULT_WIDGET_MIN_W,
    minH: limits?.minH ?? DEFAULT_WIDGET_MIN_H,
    ...(limits?.maxW !== undefined ? { maxW: limits.maxW } : {}),
    ...(limits?.maxH !== undefined ? { maxH: limits.maxH } : {}),
  };
}

function placeholder(
  id: string,
  title: string,
  description: string,
  tone: PlaceholderTone,
): PlaceholderWidget {
  return placeholderWidgetSchema.parse({
    kind: "placeholder",
    id,
    title,
    description,
    tone,
    enabled: true,
  });
}

/** Default placeholder page layout used when none is persisted yet. */
export function createDefaultPageLayout(): PageLayoutDocument {
  const widgets: PlaceholderWidget[] = [
    placeholder(PLACEHOLDER_IDS.weather, "Weather", "Placeholder conditions", "accent"),
    placeholder(PLACEHOLDER_IDS.calendar, "Calendar", "Upcoming events placeholder", "default"),
    placeholder(PLACEHOLDER_IDS.markets, "Markets", "Ticker placeholder", "default"),
    placeholder(PLACEHOLDER_IDS.services, "Services", "Health checks placeholder", "muted"),
    placeholder(PLACEHOLDER_IDS.feed, "Feed", "Headlines placeholder", "default"),
    placeholder(PLACEHOLDER_IDS.notes, "Notes", "Scratch pad placeholder", "muted"),
    placeholder(PLACEHOLDER_IDS.bookmarks, "Bookmarks", "Quick links placeholder", "default"),
    placeholder(PLACEHOLDER_IDS.status, "Status", "System status placeholder", "accent"),
  ];

  const layouts: BreakpointLayouts = {
    lg: [
      item(PLACEHOLDER_IDS.weather, 0, 0, 4, 2, { maxW: 8, maxH: 4 }),
      item(PLACEHOLDER_IDS.calendar, 4, 0, 4, 2, { maxW: 8, maxH: 4 }),
      item(PLACEHOLDER_IDS.markets, 8, 0, 4, 2, { maxW: 8, maxH: 4 }),
      item(PLACEHOLDER_IDS.services, 0, 2, 6, 2, { maxW: 12, maxH: 4 }),
      item(PLACEHOLDER_IDS.feed, 6, 2, 6, 3, { minW: 3, maxW: 12, maxH: 6 }),
      item(PLACEHOLDER_IDS.notes, 0, 5, 4, 2, { maxW: 8, maxH: 4 }),
      item(PLACEHOLDER_IDS.bookmarks, 4, 5, 4, 2, { maxW: 8, maxH: 4 }),
      item(PLACEHOLDER_IDS.status, 8, 5, 4, 1, { minH: 1, maxW: 8, maxH: 2 }),
    ],
    md: [
      item(PLACEHOLDER_IDS.weather, 0, 0, 4, 2, { maxW: 8, maxH: 4 }),
      item(PLACEHOLDER_IDS.calendar, 4, 0, 4, 2, { maxW: 8, maxH: 4 }),
      item(PLACEHOLDER_IDS.markets, 0, 2, 4, 2, { maxW: 8, maxH: 4 }),
      item(PLACEHOLDER_IDS.services, 4, 2, 4, 2, { maxW: 8, maxH: 4 }),
      item(PLACEHOLDER_IDS.feed, 0, 4, 8, 3, { minW: 3, maxW: 8, maxH: 6 }),
      item(PLACEHOLDER_IDS.notes, 0, 7, 4, 2, { maxW: 8, maxH: 4 }),
      item(PLACEHOLDER_IDS.bookmarks, 4, 7, 4, 2, { maxW: 8, maxH: 4 }),
      item(PLACEHOLDER_IDS.status, 0, 9, 8, 1, { minH: 1, maxW: 8, maxH: 2 }),
    ],
    sm: [
      item(PLACEHOLDER_IDS.weather, 0, 0, 4, 2, { maxW: 4, maxH: 4 }),
      item(PLACEHOLDER_IDS.calendar, 0, 2, 4, 2, { maxW: 4, maxH: 4 }),
      item(PLACEHOLDER_IDS.markets, 0, 4, 4, 2, { maxW: 4, maxH: 4 }),
      item(PLACEHOLDER_IDS.services, 0, 6, 4, 2, { maxW: 4, maxH: 4 }),
      item(PLACEHOLDER_IDS.feed, 0, 8, 4, 3, { minW: 2, maxW: 4, maxH: 6 }),
      item(PLACEHOLDER_IDS.notes, 0, 11, 4, 2, { maxW: 4, maxH: 4 }),
      item(PLACEHOLDER_IDS.bookmarks, 0, 13, 4, 2, { maxW: 4, maxH: 4 }),
      item(PLACEHOLDER_IDS.status, 0, 15, 4, 1, { minH: 1, maxW: 4, maxH: 2 }),
    ],
  };

  return pageLayoutDocumentSchema.parse({ version: 1, widgets, layouts });
}

export function serializePageLayout(document: PageLayoutDocument): string {
  const parsed = pageLayoutDocumentSchema.parse(document);
  return JSON.stringify(parsed);
}

export function parsePageLayout(raw: unknown): PageLayoutDocument {
  if (typeof raw === "string") {
    let decoded: unknown;
    try {
      decoded = JSON.parse(raw) as unknown;
    } catch {
      throw new Error("Invalid page layout JSON");
    }
    return pageLayoutDocumentSchema.parse(decoded);
  }
  return pageLayoutDocumentSchema.parse(raw);
}

export function clonePageLayout(document: PageLayoutDocument): PageLayoutDocument {
  return structuredClone(document);
}

export function layoutsEqual(a: PageLayoutDocument, b: PageLayoutDocument): boolean {
  return serializePageLayout(a) === serializePageLayout(b);
}

/** Axis-aligned overlap test used by collision handling. */
export function itemsCollide(a: LayoutItem, b: LayoutItem): boolean {
  if (a.i === b.i) {
    return false;
  }
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function findCollisions(layout: LayoutItem[]): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < layout.length; i += 1) {
    const left = layout[i];
    if (!left) {
      continue;
    }
    for (let j = i + 1; j < layout.length; j += 1) {
      const right = layout[j];
      if (!right) {
        continue;
      }
      if (itemsCollide(left, right)) {
        pairs.push([left.i, right.i]);
      }
    }
  }
  return pairs;
}

export function hasCollisions(layout: LayoutItem[]): boolean {
  return findCollisions(layout).length > 0;
}

export function clampItemToCols(itemIn: LayoutItem, cols: number): LayoutItem {
  const minW = Math.min(itemIn.minW ?? DEFAULT_WIDGET_MIN_W, cols);
  const maxW = Math.min(itemIn.maxW ?? cols, cols);
  const w = Math.min(Math.max(itemIn.w, minW), maxW);
  const x = Math.min(Math.max(0, itemIn.x), Math.max(0, cols - w));
  const minH = itemIn.minH ?? DEFAULT_WIDGET_MIN_H;
  const maxH = itemIn.maxH;
  const h =
    maxH === undefined ? Math.max(itemIn.h, minH) : Math.min(Math.max(itemIn.h, minH), maxH);
  return {
    ...itemIn,
    x,
    w,
    h,
    minW,
    ...(itemIn.maxW !== undefined || maxW < cols ? { maxW } : {}),
  };
}

/**
 * Convert a layout from one column count to another by scaling x/w,
 * clamping to bounds, then vertically packing to clear collisions.
 */
export function convertLayoutBetweenBreakpoints(
  layout: LayoutItem[],
  fromCols: number,
  toCols: number,
): LayoutItem[] {
  if (fromCols <= 0 || toCols <= 0) {
    throw new Error("Column counts must be positive");
  }
  if (fromCols === toCols) {
    return layout.map((entry) => clampItemToCols(entry, toCols));
  }

  const scale = toCols / fromCols;
  const scaled = layout.map((entry) => {
    const minW = Math.min(entry.minW ?? DEFAULT_WIDGET_MIN_W, toCols);
    const maxW =
      entry.maxW === undefined
        ? undefined
        : Math.max(minW, Math.min(Math.round(entry.maxW * scale), toCols));
    const rawW = Math.max(minW, Math.round(entry.w * scale));
    const w = maxW === undefined ? Math.min(rawW, toCols) : Math.min(rawW, maxW);
    const x = Math.min(Math.round(entry.x * scale), Math.max(0, toCols - w));
    return clampItemToCols(
      {
        ...entry,
        x,
        w,
        minW,
        ...(maxW !== undefined ? { maxW } : {}),
      },
      toCols,
    );
  });

  return compactLayoutVertically(scaled, toCols);
}

/** Greedy vertical compaction that resolves overlaps while preserving row order. */
export function compactLayoutVertically(layout: LayoutItem[], cols: number): LayoutItem[] {
  const sorted = [...layout]
    .map((entry) => clampItemToCols(entry, cols))
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const placed: LayoutItem[] = [];
  for (const entry of sorted) {
    let next = { ...entry, y: 0 };
    while (placed.some((candidate) => itemsCollide(next, candidate))) {
      next = { ...next, y: next.y + 1 };
    }
    placed.push(next);
  }
  return placed;
}

export function resolveBreakpoint(width: number): LayoutBreakpoint {
  if (width >= LAYOUT_BREAKPOINTS.lg) {
    return "lg";
  }
  if (width >= LAYOUT_BREAKPOINTS.md) {
    return "md";
  }
  return "sm";
}

export function moveLayoutItem(
  layout: LayoutItem[],
  itemId: string,
  dx: number,
  dy: number,
  cols: number,
): LayoutItem[] {
  const current = layout.find((entry) => entry.i === itemId);
  if (!current || current.static) {
    return layout;
  }

  const moved = clampItemToCols(
    {
      ...current,
      x: current.x + dx,
      y: Math.max(0, current.y + dy),
    },
    cols,
  );

  const without = layout.filter((entry) => entry.i !== itemId);
  const colliding = without.filter((entry) => itemsCollide(moved, entry));
  if (colliding.length === 0) {
    return [...without, moved];
  }

  // Swap with a single overlapping neighbor when the move is a unit step.
  if (colliding.length === 1 && Math.abs(dx) + Math.abs(dy) === 1) {
    const other = colliding[0];
    if (!other || other.static) {
      return layout;
    }
    const swappedOther = clampItemToCols({ ...other, x: current.x, y: current.y }, cols);
    const swappedMoved = clampItemToCols({ ...moved }, cols);
    if (itemsCollide(swappedMoved, swappedOther)) {
      return layout;
    }
    return [...without.filter((entry) => entry.i !== other.i), swappedOther, swappedMoved];
  }

  return compactLayoutVertically([...without, moved], cols);
}

/** Lowest y that fits a w×h block without overlapping existing items. */
export function findOpenSlot(
  layout: LayoutItem[],
  cols: number,
  w: number,
  h: number,
): { x: number; y: number } {
  const width = Math.min(Math.max(1, w), cols);
  const height = Math.max(1, h);
  const maxBottom = layout.reduce((max, entry) => Math.max(max, entry.y + entry.h), 0);

  for (let y = 0; y <= maxBottom; y += 1) {
    for (let x = 0; x <= cols - width; x += 1) {
      const candidate: LayoutItem = {
        i: "__candidate__",
        x,
        y,
        w: width,
        h: height,
      };
      if (!layout.some((entry) => itemsCollide(candidate, entry))) {
        return { x, y };
      }
    }
  }

  return { x: 0, y: maxBottom };
}

function placementForBreakpoint(
  size: WidgetPlacementSize,
  breakpoint: LayoutBreakpoint,
): { w: number; h: number; minW: number; minH: number; maxW?: number; maxH?: number } {
  const cols = LAYOUT_COLS[breakpoint];
  let w = size.colSpan;
  if (breakpoint === "md") {
    w = size.tabletColSpan ?? Math.min(size.colSpan, cols);
  } else if (breakpoint === "sm") {
    w = size.mobileColSpan ?? Math.min(size.colSpan, cols);
  }
  w = Math.min(Math.max(1, w), cols);
  const h = Math.max(1, size.rowSpan);
  const minW = Math.min(size.minColSpan ?? DEFAULT_WIDGET_MIN_W, cols);
  const minH = size.minRowSpan ?? DEFAULT_WIDGET_MIN_H;
  const maxW =
    size.maxColSpan === undefined ? undefined : Math.min(Math.max(minW, size.maxColSpan), cols);
  const maxH = size.maxRowSpan;
  return {
    w,
    h,
    minW,
    minH,
    ...(maxW !== undefined ? { maxW } : {}),
    ...(maxH !== undefined ? { maxH } : {}),
  };
}

function createLayoutItemForWidget(
  widgetId: string,
  size: WidgetPlacementSize,
  breakpoint: LayoutBreakpoint,
  existing: LayoutItem[],
): LayoutItem {
  const cols = LAYOUT_COLS[breakpoint];
  const placement = placementForBreakpoint(size, breakpoint);
  const slot = findOpenSlot(existing, cols, placement.w, placement.h);
  return clampItemToCols(
    {
      i: widgetId,
      x: slot.x,
      y: slot.y,
      w: placement.w,
      h: placement.h,
      minW: placement.minW,
      minH: placement.minH,
      ...(placement.maxW !== undefined ? { maxW: placement.maxW } : {}),
      ...(placement.maxH !== undefined ? { maxH: placement.maxH } : {}),
    },
    cols,
  );
}

/** Insert a widget and place it on every breakpoint. */
export function addWidgetToLayout(
  document: PageLayoutDocument,
  widget: PageWidget,
  size: WidgetPlacementSize,
): PageLayoutDocument {
  if (document.widgets.some((entry) => entry.id === widget.id)) {
    throw new Error(`Widget id ${widget.id} already exists on this page`);
  }

  const parsedWidget = pageWidgetSchema.parse(widget) as PageWidget;
  const parsedSize = widgetPlacementSizeSchema.parse(size);

  const layouts: BreakpointLayouts = {
    lg: [
      ...document.layouts.lg,
      createLayoutItemForWidget(parsedWidget.id, parsedSize, "lg", document.layouts.lg),
    ],
    md: [
      ...document.layouts.md,
      createLayoutItemForWidget(parsedWidget.id, parsedSize, "md", document.layouts.md),
    ],
    sm: [
      ...document.layouts.sm,
      createLayoutItemForWidget(parsedWidget.id, parsedSize, "sm", document.layouts.sm),
    ],
  };

  return pageLayoutDocumentSchema.parse({
    ...document,
    widgets: [...document.widgets, parsedWidget],
    layouts,
  });
}

/** Remove a widget and its layout items from every breakpoint. */
export function removeWidgetFromLayout(
  document: PageLayoutDocument,
  widgetId: string,
): PageLayoutDocument {
  if (!document.widgets.some((entry) => entry.id === widgetId)) {
    throw new Error(`Widget id ${widgetId} was not found on this page`);
  }

  return pageLayoutDocumentSchema.parse({
    ...document,
    widgets: document.widgets.filter((entry) => entry.id !== widgetId),
    layouts: {
      lg: document.layouts.lg.filter((entry) => entry.i !== widgetId),
      md: document.layouts.md.filter((entry) => entry.i !== widgetId),
      sm: document.layouts.sm.filter((entry) => entry.i !== widgetId),
    },
  });
}

function clonePageWidget(widget: PageWidget, newId: string): PageWidget {
  if (isPlaceholderWidget(widget)) {
    return placeholderWidgetSchema.parse({
      ...widget,
      id: newId,
      title: `${widget.title} copy`,
      lastUpdatedAt: null,
    });
  }
  return typedWidgetInstanceSchema.parse({
    ...widget,
    id: newId,
    title: `${widget.title} copy`,
    config: structuredClone(widget.config),
    lastUpdatedAt: null,
  });
}

/** Duplicate a widget instance with a new id, placed below the original. */
export function duplicateWidgetInLayout(
  document: PageLayoutDocument,
  widgetId: string,
  newId: string,
): PageLayoutDocument {
  const source = document.widgets.find((entry) => entry.id === widgetId);
  if (!source) {
    throw new Error(`Widget id ${widgetId} was not found on this page`);
  }
  if (document.widgets.some((entry) => entry.id === newId)) {
    throw new Error(`Widget id ${newId} already exists on this page`);
  }

  const clone = clonePageWidget(source, newId);

  const layouts: BreakpointLayouts = {
    lg: [...document.layouts.lg],
    md: [...document.layouts.md],
    sm: [...document.layouts.sm],
  };

  for (const breakpoint of layoutBreakpointSchema.options) {
    const original = document.layouts[breakpoint].find((entry) => entry.i === widgetId);
    if (!original) {
      continue;
    }
    const cols = LAYOUT_COLS[breakpoint];
    const slot = findOpenSlot(layouts[breakpoint], cols, original.w, original.h);
    layouts[breakpoint] = [
      ...layouts[breakpoint],
      clampItemToCols(
        {
          ...original,
          i: newId,
          x: slot.x,
          y: slot.y,
        },
        cols,
      ),
    ];
  }

  return pageLayoutDocumentSchema.parse({
    ...document,
    widgets: [...document.widgets, clone],
    layouts,
  });
}

/** Replace a widget record in place (config/title/enabled/etc.) without moving layout. */
export function updateWidgetInLayout(
  document: PageLayoutDocument,
  widgetId: string,
  updater: (widget: PageWidget) => PageWidget,
): PageLayoutDocument {
  const index = document.widgets.findIndex((entry) => entry.id === widgetId);
  if (index < 0) {
    throw new Error(`Widget id ${widgetId} was not found on this page`);
  }
  const current = document.widgets[index];
  if (!current) {
    throw new Error(`Widget id ${widgetId} was not found on this page`);
  }
  const nextWidget = pageWidgetSchema.parse(updater(current)) as PageWidget;
  if (nextWidget.id !== widgetId) {
    throw new Error("Widget id cannot change during update");
  }
  const widgets = [...document.widgets];
  widgets[index] = nextWidget;
  return pageLayoutDocumentSchema.parse({
    ...document,
    widgets,
  });
}

export function createEmptyPageLayout(): PageLayoutDocument {
  return pageLayoutDocumentSchema.parse({
    version: 1,
    widgets: [],
    layouts: { lg: [], md: [], sm: [] },
  });
}
