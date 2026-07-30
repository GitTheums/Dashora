import { z } from "zod";

/**
 * Icon metadata for catalog tiles. The `name` is a stable key resolved by the
 * web app’s icon set — the SDK does not ship SVG assets.
 */
export const widgetIconSchema = z.object({
  /** Logical icon key (for example "chart", "clock", "rss"). */
  name: z.string().min(1).max(64),
  /** Optional accessible label; defaults to the widget name in the UI. */
  label: z.string().min(1).max(80).optional(),
});

export type WidgetIcon = z.infer<typeof widgetIconSchema>;
