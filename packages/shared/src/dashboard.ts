import { z } from "zod";
import { dashboardThemeOverrideSchema } from "./theme.js";

/** Icon keys rendered by the web app; stored as plain strings on the server. */
export const pageIconSchema = z.enum([
  "home",
  "chart",
  "gamepad",
  "server",
  "bookmark",
  "calendar",
  "cloud",
  "grid",
  "star",
  "wrench",
]);

export type PageIcon = z.infer<typeof pageIconSchema>;

export const PAGE_ICONS = pageIconSchema.options;

/** URL-safe slug unique within a dashboard. */
export const pageSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Slug is required")
  .max(64, "Slug must be at most 64 characters")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must use lowercase letters, numbers, and hyphens");

export type PageSlug = z.infer<typeof pageSlugSchema>;

export const pageNameSchema = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(80, "Name must be at most 80 characters");

/** Optional accent as `#RRGGBB` or empty/null to clear. */
export const pageAccentSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Accent must be a hex color like #3B82F6")
  .nullable()
  .optional();

export const pageSchema = z.object({
  id: z.string().uuid(),
  dashboardId: z.string().uuid(),
  name: pageNameSchema,
  slug: pageSlugSchema,
  icon: pageIconSchema,
  accent: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable(),
  sortOrder: z.number().int().min(0),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export type Page = z.infer<typeof pageSchema>;

export const dashboardSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(64),
  pages: z.array(pageSchema),
  themeOverride: dashboardThemeOverrideSchema.nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export type Dashboard = z.infer<typeof dashboardSchema>;

export const dashboardResponseSchema = z.object({
  dashboard: dashboardSchema,
});

export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;

export const createPageRequestSchema = z.object({
  name: pageNameSchema,
  slug: pageSlugSchema,
  icon: pageIconSchema.default("grid"),
  accent: pageAccentSchema,
});

export type CreatePageRequest = z.infer<typeof createPageRequestSchema>;

export const updatePageRequestSchema = z
  .object({
    name: pageNameSchema.optional(),
    slug: pageSlugSchema.optional(),
    icon: pageIconSchema.optional(),
    accent: pageAccentSchema,
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.slug !== undefined ||
      value.icon !== undefined ||
      value.accent !== undefined,
    { message: "At least one field is required" },
  );

export type UpdatePageRequest = z.infer<typeof updatePageRequestSchema>;

export const pageResponseSchema = z.object({
  page: pageSchema,
});

export type PageResponse = z.infer<typeof pageResponseSchema>;

export const reorderPagesRequestSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});

export type ReorderPagesRequest = z.infer<typeof reorderPagesRequestSchema>;

export const deletePageResponseSchema = z.object({
  ok: z.literal(true),
  deletedId: z.string().uuid(),
});

export type DeletePageResponse = z.infer<typeof deletePageResponseSchema>;

/** Default pages created with a user's first dashboard. */
export const DEFAULT_DASHBOARD_PAGES = [
  { name: "Home", slug: "home", icon: "home" as const },
  { name: "Markets", slug: "markets", icon: "chart" as const },
  { name: "Gaming", slug: "gaming", icon: "gamepad" as const },
  { name: "Homelab", slug: "homelab", icon: "server" as const },
] as const;

export const DEFAULT_DASHBOARD_NAME = "Dashboard";
export const DEFAULT_DASHBOARD_SLUG = "default";
