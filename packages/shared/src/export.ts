import { z } from "zod";
import { pageAccentSchema, pageIconSchema, pageSlugSchema } from "./dashboard.js";
import { pageLayoutDocumentSchema } from "./layout.js";
import { dashboardThemeOverrideSchema, themePreferencesSchema } from "./theme.js";

/** Recursive JSON value/object schemas, mirrored from the server's DB JSON helpers. */
const exportJsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(exportJsonValueSchema),
    z.record(exportJsonValueSchema),
  ]),
);

export const exportJsonObjectSchema = z.record(exportJsonValueSchema);

export const EXPORT_FORMAT = "dashora-config" as const;
export const EXPORT_FORMAT_VERSION = 1 as const;

/** Cheap pre-check parsed before the full schema, so malformed/future files fail fast. */
export const exportEnvelopeSchema = z.object({
  format: z.string(),
  formatVersion: z.number().int().positive(),
});

export type ExportEnvelope = z.infer<typeof exportEnvelopeSchema>;

export const exportedIntegrationSchema = z.object({
  id: z.string().uuid(),
  provider: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  /** Non-secret provider config only; secrets never leave the server. */
  config: exportJsonObjectSchema,
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export type ExportedIntegration = z.infer<typeof exportedIntegrationSchema>;

export const exportedTodoItemSchema = z.object({
  /** Widget id within the owning page's layout document. */
  instanceId: z.string().uuid(),
  title: z.string().min(1).max(240),
  completed: z.boolean(),
  dueAt: z.string().nullable(),
  sortOrder: z.number().int(),
});

export type ExportedTodoItem = z.infer<typeof exportedTodoItemSchema>;

export const exportedPageSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(80),
  slug: pageSlugSchema,
  icon: pageIconSchema,
  accent: pageAccentSchema.nullable().default(null),
  sortOrder: z.number().int().min(0),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  /** `null` means the page was never customized and uses the default layout. */
  layout: pageLayoutDocumentSchema.nullable(),
  todos: z.array(exportedTodoItemSchema).max(500),
});

export type ExportedPage = z.infer<typeof exportedPageSchema>;

export const exportedDashboardSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(64),
  themeOverride: dashboardThemeOverrideSchema.nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  pages: z.array(exportedPageSchema).max(100),
});

export type ExportedDashboard = z.infer<typeof exportedDashboardSchema>;

export const dashoraExportSchema = z.object({
  format: z.literal(EXPORT_FORMAT),
  formatVersion: z.literal(EXPORT_FORMAT_VERSION),
  exportedAt: z.string().datetime({ offset: true }),
  generator: z.object({
    app: z.literal("dashora"),
    serverVersion: z.string().min(1).max(64),
  }),
  data: z.object({
    themePreferences: themePreferencesSchema.nullable(),
    integrations: z.array(exportedIntegrationSchema).max(200),
    dashboards: z.array(exportedDashboardSchema).max(50),
  }),
});

export type DashoraExport = z.infer<typeof dashoraExportSchema>;

export const importModeSchema = z.enum(["replace", "merge"]);
export type ImportMode = z.infer<typeof importModeSchema>;

export const skippedIntegrationSchema = z.object({
  id: z.string().uuid(),
  provider: z.string(),
  name: z.string(),
  reason: z.literal("secret_required"),
});

export type SkippedIntegration = z.infer<typeof skippedIntegrationSchema>;

export const renamedSlugSchema = z.object({
  from: z.string(),
  to: z.string(),
});

export type RenamedSlug = z.infer<typeof renamedSlugSchema>;

export const importSummarySchema = z.object({
  mode: importModeSchema,
  dashboardsCreated: z.number().int().nonnegative(),
  pagesCreated: z.number().int().nonnegative(),
  widgetsCreated: z.number().int().nonnegative(),
  todosCreated: z.number().int().nonnegative(),
  integrationsCreated: z.number().int().nonnegative(),
  skippedIntegrations: z.array(skippedIntegrationSchema),
  themePreferencesApplied: z.boolean(),
  renamedSlugs: z.array(renamedSlugSchema),
  warnings: z.array(z.string()),
});

export type ImportSummary = z.infer<typeof importSummarySchema>;

export const importRequestSchema = z.object({
  mode: importModeSchema,
  /** Migrated/validated inside the backup service so older export versions can be accepted. */
  file: z.unknown(),
});

export type ImportRequest = z.infer<typeof importRequestSchema>;

export const importSummaryResponseSchema = z.object({
  summary: importSummarySchema,
});

export type ImportSummaryResponse = z.infer<typeof importSummaryResponseSchema>;

export type ExportFormatErrorCode = "invalid_format" | "unsupported_version" | "validation_error";

/** Thrown by `migrateExportPayload` for malformed, future-versioned, or invalid export files. */
export class ExportFormatError extends Error {
  readonly code: ExportFormatErrorCode;
  readonly issues?: z.ZodIssue[];

  constructor(code: ExportFormatErrorCode, message: string, issues?: z.ZodIssue[]) {
    super(message);
    this.name = "ExportFormatError";
    this.code = code;
    if (issues) {
      this.issues = issues;
    }
  }
}

type ExportMigration = {
  fromVersion: number;
  migrate: (raw: Record<string, unknown>) => Record<string, unknown>;
};

/**
 * Sequential migrations applied to older export files before the current schema parses them.
 * Add an entry here (and bump nothing else) whenever `EXPORT_FORMAT_VERSION` increases:
 *
 *   MIGRATIONS.push({ fromVersion: 1, migrate: migrateV1ToV2 });
 */
const MIGRATIONS: ExportMigration[] = [];

/**
 * Validates the envelope, runs any needed version migrations, then validates the full
 * current-version schema. Throws `ExportFormatError` for malformed, unsupported, or
 * invalid files — callers must not write any data until this resolves successfully.
 */
export function migrateExportPayload(raw: unknown): DashoraExport {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new ExportFormatError("invalid_format", "Export file must be a JSON object");
  }

  const envelope = exportEnvelopeSchema.safeParse(raw);
  if (!envelope.success) {
    throw new ExportFormatError(
      "invalid_format",
      "Export file is missing a valid format/formatVersion envelope",
      envelope.error.issues,
    );
  }
  if (envelope.data.format !== EXPORT_FORMAT) {
    throw new ExportFormatError(
      "invalid_format",
      `Unrecognized export format "${envelope.data.format}"`,
    );
  }
  if (envelope.data.formatVersion > EXPORT_FORMAT_VERSION) {
    throw new ExportFormatError(
      "unsupported_version",
      `Export file was created by a newer Dashora version (formatVersion ${envelope.data.formatVersion}); this server supports up to ${EXPORT_FORMAT_VERSION}`,
    );
  }

  let current = raw as Record<string, unknown>;
  let version = envelope.data.formatVersion;
  while (version < EXPORT_FORMAT_VERSION) {
    const step = MIGRATIONS.find((migration) => migration.fromVersion === version);
    if (!step) {
      throw new ExportFormatError(
        "unsupported_version",
        `No migration available from export formatVersion ${version}`,
      );
    }
    current = step.migrate(current);
    version += 1;
  }

  const parsed = dashoraExportSchema.safeParse(current);
  if (!parsed.success) {
    throw new ExportFormatError(
      "validation_error",
      "Export file failed schema validation",
      parsed.error.issues,
    );
  }
  return parsed.data;
}
