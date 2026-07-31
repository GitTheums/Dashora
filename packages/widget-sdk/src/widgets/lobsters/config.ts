import { z } from "zod";

export const lobstersSourceKindSchema = z.enum(["hottest", "newest", "active", "tag"]);
export type LobstersSourceKind = z.infer<typeof lobstersSourceKindSchema>;

export const lobstersLayoutSchema = z.enum(["compact", "rich"]);
export type LobstersLayout = z.infer<typeof lobstersLayoutSchema>;

export const lobstersSourceConfigSchema = z
  .object({
    id: z.string().uuid(),
    kind: lobstersSourceKindSchema,
    tag: z.string().trim().min(1).max(50).optional(),
    label: z.string().trim().max(80).optional(),
    itemLimit: z.number().int().min(1).max(50).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "tag" && (!value.tag || !value.tag.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Tag is required when kind is tag.",
        path: ["tag"],
      });
    }
  });

export type LobstersSourceConfig = z.infer<typeof lobstersSourceConfigSchema>;

export const lobstersConfigSchema = z.object({
  sources: z.array(lobstersSourceConfigSchema).max(10).default([]),
  /** Global cap after per-source limits. */
  maxItems: z.number().int().min(1).max(100).default(20),
  /** Default per-source item limit when a source omits `itemLimit`. */
  defaultItemLimit: z.number().int().min(1).max(50).default(10),
  layout: lobstersLayoutSchema.default("rich"),
  showScore: z.boolean().default(true),
  showCommentCount: z.boolean().default(true),
  openInNewTab: z.boolean().default(true),
  enabled: z.boolean().default(true),
});

export type LobstersConfig = z.infer<typeof lobstersConfigSchema>;

export const LOBSTERS_DEFAULT_CONFIG: LobstersConfig = lobstersConfigSchema.parse({});

export const lobstersSourceStatusSchema = z.enum(["ok", "empty", "error"]);
export type LobstersSourceStatus = z.infer<typeof lobstersSourceStatusSchema>;

export const lobstersSourceResultSchema = z.object({
  id: z.string().uuid(),
  kind: lobstersSourceKindSchema,
  tag: z.string().max(50).optional(),
  label: z.string().min(1).max(120),
  status: lobstersSourceStatusSchema,
  message: z.string().max(240).optional(),
  itemCount: z.number().int().nonnegative(),
  cacheStatus: z.enum(["hit", "miss", "stale", "bypass"]).optional(),
});

export type LobstersSourceResult = z.infer<typeof lobstersSourceResultSchema>;

export const lobstersItemSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(240),
  url: z.string().url().nullable(),
  commentsUrl: z.string().url(),
  score: z.number().int().nonnegative(),
  commentCount: z.number().int().nonnegative(),
  author: z.string().min(1).max(80),
  publishedAt: z.string().datetime({ offset: true }).nullable(),
  tags: z.array(z.string().min(1).max(50)).max(20),
  sourceId: z.string().uuid(),
  sourceLabel: z.string().min(1).max(120),
});

export type LobstersItem = z.infer<typeof lobstersItemSchema>;

export const lobstersDataSchema = z.object({
  layout: lobstersLayoutSchema,
  showScore: z.boolean(),
  showCommentCount: z.boolean(),
  openInNewTab: z.boolean(),
  items: z.array(lobstersItemSchema).max(100),
  sources: z.array(lobstersSourceResultSchema).max(10),
  fetchedAt: z.string().datetime({ offset: true }),
  failedSourceCount: z.number().int().nonnegative(),
});

export type LobstersData = z.infer<typeof lobstersDataSchema>;

export const LOBSTERS_SOURCE_KIND_LABELS: Record<LobstersSourceKind, string> = {
  hottest: "Hottest",
  newest: "Newest",
  active: "Active",
  tag: "Tag",
};

export function newLobstersSourceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `a${Date.now().toString(16).padStart(11, "0")}-1111-4111-8111-${Math.floor(
    Math.random() * 1e12,
  )
    .toString(16)
    .padStart(12, "0")}`;
}
