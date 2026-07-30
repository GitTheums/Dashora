import { z } from "zod";

/**
 * Default grid placement hints for a widget type (12-column desktop layout).
 * Breakpoint-specific overrides are optional; the layout engine clamps as needed.
 */
export const widgetDefaultLayoutSchema = z.object({
  /** Default column span on the wide (lg) breakpoint. */
  colSpan: z.number().int().min(1).max(12),
  /** Default row span (grid row units). */
  rowSpan: z.number().int().min(1).max(24).default(2),
  minColSpan: z.number().int().min(1).max(12).default(2),
  minRowSpan: z.number().int().min(1).max(24).default(1),
  maxColSpan: z.number().int().min(1).max(12).optional(),
  maxRowSpan: z.number().int().min(1).max(24).optional(),
  /** Suggested tablet (md) span when different from a simple clamp. */
  tabletColSpan: z.number().int().min(1).max(8).optional(),
  /** Suggested mobile (sm) span. */
  mobileColSpan: z.number().int().min(1).max(4).optional(),
});

export type WidgetDefaultLayout = z.infer<typeof widgetDefaultLayoutSchema>;

export const DEFAULT_WIDGET_LAYOUT: WidgetDefaultLayout = {
  colSpan: 4,
  rowSpan: 2,
  minColSpan: 2,
  minRowSpan: 1,
  tabletColSpan: 4,
  mobileColSpan: 4,
};
