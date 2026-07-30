import { z } from "zod";

/** Design-token accent keys for bookmark chrome (maps to `--ds-*` CSS variables). */
export const bookmarkColorTokenSchema = z.enum([
  "primary",
  "secondary",
  "success",
  "warning",
  "danger",
  "muted",
]);

export type BookmarkColorToken = z.infer<typeof bookmarkColorTokenSchema>;

export const BOOKMARK_COLOR_CSS: Record<BookmarkColorToken, string> = {
  primary: "var(--ds-primary)",
  secondary: "var(--ds-secondary)",
  success: "var(--ds-success)",
  warning: "var(--ds-warning)",
  danger: "var(--ds-danger)",
  muted: "var(--ds-fg-muted)",
};

export const bookmarkIconSchema = z.enum([
  "link",
  "home",
  "book",
  "cloud",
  "mail",
  "code",
  "globe",
  "star",
]);

export type BookmarkIcon = z.infer<typeof bookmarkIconSchema>;

export const bookmarkItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(80),
  url: z
    .string()
    .trim()
    .url()
    .refine((value) => /^https?:\/\//i.test(value), "Bookmark URLs must use http or https"),
  description: z.string().trim().max(160).optional().default(""),
  icon: bookmarkIconSchema.default("link"),
});

export type BookmarkItem = z.infer<typeof bookmarkItemSchema>;

export const bookmarkGroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(40),
  color: bookmarkColorTokenSchema.default("primary"),
  items: z.array(bookmarkItemSchema).max(40).default([]),
});

export type BookmarkGroup = z.infer<typeof bookmarkGroupSchema>;

export const bookmarksConfigSchema = z.object({
  groups: z.array(bookmarkGroupSchema).max(20).default([]),
  openInNewTab: z.boolean().default(true),
  showDescriptions: z.boolean().default(true),
  enabled: z.boolean().default(true),
});

export type BookmarksConfig = z.infer<typeof bookmarksConfigSchema>;

export const BOOKMARKS_DEFAULT_CONFIG: BookmarksConfig = bookmarksConfigSchema.parse({});

export const bookmarksDataSchema = z.object({
  groups: z.array(bookmarkGroupSchema),
  openInNewTab: z.boolean(),
  showDescriptions: z.boolean(),
  totalItems: z.number().int().nonnegative(),
});

export type BookmarksData = z.infer<typeof bookmarksDataSchema>;

export function resolveBookmarksData(config: BookmarksConfig): BookmarksData {
  const totalItems = config.groups.reduce((sum, group) => sum + group.items.length, 0);
  return bookmarksDataSchema.parse({
    groups: config.groups,
    openInNewTab: config.openInNewTab,
    showDescriptions: config.showDescriptions,
    totalItems,
  });
}

export function reorderBookmarkItems(
  groups: BookmarkGroup[],
  groupId: string,
  fromIndex: number,
  toIndex: number,
): BookmarkGroup[] {
  return groups.map((group) => {
    if (group.id !== groupId) {
      return group;
    }
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= group.items.length ||
      toIndex >= group.items.length ||
      fromIndex === toIndex
    ) {
      return group;
    }
    const items = [...group.items];
    const [moved] = items.splice(fromIndex, 1);
    if (!moved) {
      return group;
    }
    items.splice(toIndex, 0, moved);
    return { ...group, items };
  });
}
