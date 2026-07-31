import { z } from "zod";

/**
 * Stable widget catalog categories for the picker and docs.
 */
export const WIDGET_CATEGORIES = [
  "productivity",
  "media",
  "network",
  "home",
  "finance",
  "development",
  "utilities",
  "other",
] as const;

export const widgetCategorySchema = z.enum(WIDGET_CATEGORIES);

export type WidgetCategory = z.infer<typeof widgetCategorySchema>;

export const WIDGET_CATEGORY_LABELS: Record<WidgetCategory, string> = {
  productivity: "Productivity",
  media: "Media",
  network: "Network",
  home: "Home",
  finance: "Finance",
  development: "Development",
  utilities: "Utilities",
  other: "Other",
};
