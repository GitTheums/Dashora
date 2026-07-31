import { randomUUID } from "node:crypto";
import {
  type DashoraExport,
  EXPORT_FORMAT,
  EXPORT_FORMAT_VERSION,
  type ExportedDashboard,
  type ExportedPage,
  type ImportMode,
  type ImportSummary,
  type LayoutItem,
  type PageLayoutDocument,
  type SkippedIntegration,
  type ThemePreferences,
  dashoraExportSchema,
  isTypedWidgetInstance,
  migrateExportPayload,
  pageIconSchema,
  pageLayoutDocumentSchema,
  parseStoredDashboardThemeOverride,
  parseStoredThemePreferences,
} from "@dashora/shared";
import { and, eq } from "drizzle-orm";
import type { DashoraDatabase } from "../db/client.js";
import type { DashboardRecord } from "../db/repositories/dashboards.js";
import type { Repositories } from "../db/repositories/index.js";
import type { PageRecord } from "../db/repositories/pages.js";
import { dashboards, integrations, pageLayouts, pages, settings, todoItems } from "../db/schema.js";
import { nowEpochMillis } from "../db/timestamps.js";
import { THEME_SETTINGS_KEY } from "./theme-settings-service.js";

export type BackupServiceErrorCode = "import_failed";

export class BackupServiceError extends Error {
  readonly code: BackupServiceErrorCode;

  constructor(code: BackupServiceErrorCode, message: string) {
    super(message);
    this.name = "BackupServiceError";
    this.code = code;
  }
}

export type BackupService = {
  exportConfig: (userId: string) => Promise<DashoraExport>;
  previewImport: (userId: string, rawFile: unknown, mode: ImportMode) => Promise<ImportSummary>;
  runImport: (userId: string, rawFile: unknown, mode: ImportMode) => Promise<ImportSummary>;
};

export type BackupServiceOptions = {
  repos: Repositories;
  db: DashoraDatabase;
  serverVersion: string;
};

/** Field names within widget `config` blobs that reference an integration id. */
const CREDENTIAL_REF_KEYS = new Set(["credentialId", "secretId"]);
const MAX_CONFIG_WALK_DEPTH = 12;

/**
 * Recursively rewrites `credentialId`/`secretId` string fields anywhere inside a widget
 * config using the integration id map. Unresolved references are cleared (set to null)
 * with a warning, rather than left dangling or pointing at an unrelated integration.
 */
function remapCredentialRefs(
  value: unknown,
  idMap: Map<string, string>,
  warnings: string[],
  depth = 0,
): unknown {
  if (depth > MAX_CONFIG_WALK_DEPTH || value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => remapCredentialRefs(entry, idMap, warnings, depth + 1));
  }
  const result: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (CREDENTIAL_REF_KEYS.has(key) && typeof raw === "string" && raw.length > 0) {
      const mapped = idMap.get(raw);
      if (mapped) {
        result[key] = mapped;
      } else {
        result[key] = null;
        warnings.push(
          `Cleared a "${key}" reference to an integration that was not part of this import.`,
        );
      }
      continue;
    }
    result[key] = remapCredentialRefs(raw, idMap, warnings, depth + 1);
  }
  return result;
}

function toStoredThemePreferences(preferences: ThemePreferences): Record<string, unknown> {
  return {
    mode: preferences.mode,
    preset: preferences.preset,
    accent: preferences.accent,
    accentCustom: preferences.accentCustom ?? null,
    density: preferences.density,
    reducedTransparency: preferences.reducedTransparency,
    reducedMotion: preferences.reducedMotion,
    cardRadius: preferences.cardRadius,
    ambientBackground: preferences.ambientBackground,
    appName: preferences.appName ?? null,
    logoDataUrl: preferences.logoDataUrl ?? null,
  };
}

function readDashboardThemeOverrideJson(
  record: DashboardRecord,
): ExportedDashboard["themeOverride"] {
  if (!record.themeJson) {
    return null;
  }
  try {
    return parseStoredDashboardThemeOverride(JSON.parse(record.themeJson) as unknown);
  } catch {
    return null;
  }
}

function toExportedPageIcon(record: PageRecord): ExportedPage["icon"] {
  const parsed = pageIconSchema.safeParse(record.icon);
  return parsed.success ? parsed.data : "grid";
}

/** Suffix-based slug allocator, mirroring `dashboard-service.ts`'s `allocateUniqueSlug`. */
function allocateDashboardSlug(baseSlug: string, taken: Set<string>): string {
  const normalized = baseSlug.slice(0, 64);
  let candidate = normalized;
  let suffix = 2;
  while (taken.has(candidate)) {
    const suffixText = `-${suffix}`;
    candidate = `${normalized.slice(0, Math.max(1, 64 - suffixText.length))}${suffixText}`;
    suffix += 1;
  }
  return candidate;
}

type ImportPlan = {
  integrationsToInsert: Array<typeof integrations.$inferInsert>;
  dashboardsToInsert: Array<typeof dashboards.$inferInsert>;
  pagesToInsert: Array<typeof pages.$inferInsert>;
  pageLayoutsToInsert: Array<typeof pageLayouts.$inferInsert>;
  todosToInsert: Array<typeof todoItems.$inferInsert>;
  themeSettingRow: typeof settings.$inferInsert | null;
};

function remapBreakpointItems(items: LayoutItem[], widgetIdMap: Map<string, string>): LayoutItem[] {
  return items.map((item) => ({ ...item, i: widgetIdMap.get(item.i) ?? item.i }));
}

function remapPageLayout(
  layout: PageLayoutDocument,
  integrationIdMap: Map<string, string>,
  warnings: string[],
): { layout: PageLayoutDocument; widgetIdMap: Map<string, string>; widgetsCreated: number } {
  const widgetIdMap = new Map<string, string>();
  for (const widget of layout.widgets) {
    widgetIdMap.set(widget.id, randomUUID());
  }

  let widgetsCreated = 0;
  const remappedWidgets = layout.widgets.map((widget) => {
    const newId = widgetIdMap.get(widget.id);
    /* istanbul ignore next -- every widget id was just inserted into the map above */
    if (!newId) {
      throw new Error(`Internal error: missing id mapping for widget ${widget.id}`);
    }
    if (isTypedWidgetInstance(widget)) {
      widgetsCreated += 1;
      return {
        ...widget,
        id: newId,
        config: remapCredentialRefs(widget.config, integrationIdMap, warnings) as Record<
          string,
          unknown
        >,
      };
    }
    return { ...widget, id: newId };
  });

  const rebuilt = pageLayoutDocumentSchema.parse({
    version: layout.version,
    widgets: remappedWidgets,
    layouts: {
      lg: remapBreakpointItems(layout.layouts.lg, widgetIdMap),
      md: remapBreakpointItems(layout.layouts.md, widgetIdMap),
      sm: remapBreakpointItems(layout.layouts.sm, widgetIdMap),
    },
  });

  return { layout: rebuilt, widgetIdMap, widgetsCreated };
}

function planImport(params: {
  userId: string;
  file: DashoraExport;
  mode: ImportMode;
  existingDashboardSlugs: Set<string>;
  now: number;
}): { plan: ImportPlan; summary: ImportSummary } {
  const { userId, file, mode, existingDashboardSlugs, now } = params;
  const warnings: string[] = [];
  const renamedSlugs: { from: string; to: string }[] = [];
  const takenSlugs = new Set(existingDashboardSlugs);

  const integrationIdMap = new Map<string, string>();
  const integrationsToInsert: ImportPlan["integrationsToInsert"] = [];
  const skippedIntegrations: SkippedIntegration[] = [];

  for (const integration of file.data.integrations) {
    const newId = randomUUID();
    integrationIdMap.set(integration.id, newId);
    integrationsToInsert.push({
      id: newId,
      userId,
      provider: integration.provider,
      name: integration.name,
      configJson: JSON.stringify(integration.config),
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    });
    skippedIntegrations.push({
      id: newId,
      provider: integration.provider,
      name: integration.name,
      reason: "secret_required",
    });
  }

  const dashboardsToInsert: ImportPlan["dashboardsToInsert"] = [];
  const pagesToInsert: ImportPlan["pagesToInsert"] = [];
  const pageLayoutsToInsert: ImportPlan["pageLayoutsToInsert"] = [];
  const todosToInsert: ImportPlan["todosToInsert"] = [];
  let widgetsCreated = 0;

  for (const dashboardExport of file.data.dashboards) {
    const newDashboardId = randomUUID();
    let slug = dashboardExport.slug;
    if (takenSlugs.has(slug)) {
      const renamed = allocateDashboardSlug(slug, takenSlugs);
      renamedSlugs.push({ from: slug, to: renamed });
      slug = renamed;
    }
    takenSlugs.add(slug);

    dashboardsToInsert.push({
      id: newDashboardId,
      ownerUserId: userId,
      name: dashboardExport.name,
      slug,
      themeJson: dashboardExport.themeOverride
        ? JSON.stringify(dashboardExport.themeOverride)
        : null,
      createdAt: dashboardExport.createdAt,
      updatedAt: dashboardExport.updatedAt,
    });

    for (const pageExport of dashboardExport.pages) {
      const newPageId = randomUUID();
      pagesToInsert.push({
        id: newPageId,
        dashboardId: newDashboardId,
        title: pageExport.title,
        slug: pageExport.slug,
        icon: pageExport.icon,
        accent: pageExport.accent ?? null,
        sortOrder: pageExport.sortOrder,
        createdAt: pageExport.createdAt,
        updatedAt: pageExport.updatedAt,
      });

      if (!pageExport.layout) {
        if (pageExport.todos.length > 0) {
          warnings.push(
            `Skipped ${pageExport.todos.length} task(s) on "${pageExport.title}" because the page has no saved layout.`,
          );
        }
        continue;
      }

      const {
        layout,
        widgetIdMap,
        widgetsCreated: pageWidgetsCreated,
      } = remapPageLayout(pageExport.layout, integrationIdMap, warnings);
      widgetsCreated += pageWidgetsCreated;

      pageLayoutsToInsert.push({
        id: randomUUID(),
        pageId: newPageId,
        layoutsJson: JSON.stringify(layout),
        createdAt: now,
        updatedAt: now,
      });

      for (const todo of pageExport.todos) {
        const newInstanceId = widgetIdMap.get(todo.instanceId);
        if (!newInstanceId) {
          warnings.push(
            `Skipped a task ("${todo.title}") because its widget was not found on the page.`,
          );
          continue;
        }
        todosToInsert.push({
          id: randomUUID(),
          ownerUserId: userId,
          instanceId: newInstanceId,
          title: todo.title,
          completed: todo.completed,
          dueAt: todo.dueAt,
          sortOrder: todo.sortOrder,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  const themePreferencesApplied = mode === "replace" && file.data.themePreferences !== null;
  const themeSettingRow: ImportPlan["themeSettingRow"] =
    themePreferencesApplied && file.data.themePreferences
      ? {
          id: randomUUID(),
          userId,
          key: THEME_SETTINGS_KEY,
          valueJson: JSON.stringify(toStoredThemePreferences(file.data.themePreferences)),
          createdAt: now,
          updatedAt: now,
        }
      : null;

  const summary: ImportSummary = {
    mode,
    dashboardsCreated: dashboardsToInsert.length,
    pagesCreated: pagesToInsert.length,
    widgetsCreated,
    todosCreated: todosToInsert.length,
    integrationsCreated: integrationsToInsert.length,
    skippedIntegrations,
    themePreferencesApplied,
    renamedSlugs,
    warnings,
  };

  return {
    plan: {
      integrationsToInsert,
      dashboardsToInsert,
      pagesToInsert,
      pageLayoutsToInsert,
      todosToInsert,
      themeSettingRow,
    },
    summary,
  };
}

export function createBackupService(options: BackupServiceOptions): BackupService {
  const { repos, db, serverVersion } = options;

  async function exportConfig(userId: string): Promise<DashoraExport> {
    const dashboardRecords = await repos.dashboards.listByOwner(userId);
    const integrationRecords = await repos.integrations.listByUser(userId);
    const themeRow = await repos.settings.findByUserAndKey(userId, THEME_SETTINGS_KEY);

    const dashboardsOut: ExportedDashboard[] = [];
    for (const dashboardRecord of dashboardRecords) {
      const pageRecords = await repos.pages.listByDashboard(dashboardRecord.id);
      const pagesOut: ExportedPage[] = [];

      for (const pageRecord of pageRecords) {
        const layoutRow = await repos.pageLayouts.findByPageId(pageRecord.id);
        const layout = layoutRow ? layoutRow.layout : null;
        const todosOut: ExportedPage["todos"] = [];

        if (layout) {
          for (const widget of layout.widgets) {
            if (isTypedWidgetInstance(widget) && widget.type === "todo") {
              const items = await repos.todoItems.listByOwnerAndInstance(userId, widget.id);
              for (const item of items) {
                todosOut.push({
                  instanceId: widget.id,
                  title: item.title,
                  completed: item.completed,
                  dueAt: item.dueAt,
                  sortOrder: item.sortOrder,
                });
              }
            }
          }
        }

        pagesOut.push({
          id: pageRecord.id,
          title: pageRecord.title,
          slug: pageRecord.slug,
          icon: toExportedPageIcon(pageRecord),
          accent: pageRecord.accent,
          sortOrder: pageRecord.sortOrder,
          createdAt: pageRecord.createdAt,
          updatedAt: pageRecord.updatedAt,
          layout,
          todos: todosOut,
        });
      }

      dashboardsOut.push({
        id: dashboardRecord.id,
        name: dashboardRecord.name,
        slug: dashboardRecord.slug,
        themeOverride: readDashboardThemeOverrideJson(dashboardRecord),
        createdAt: dashboardRecord.createdAt,
        updatedAt: dashboardRecord.updatedAt,
        pages: pagesOut,
      });
    }

    return dashoraExportSchema.parse({
      format: EXPORT_FORMAT,
      formatVersion: EXPORT_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      generator: { app: "dashora", serverVersion },
      data: {
        themePreferences: themeRow ? parseStoredThemePreferences(themeRow.value) : null,
        integrations: integrationRecords.map((integration) => ({
          id: integration.id,
          provider: integration.provider,
          name: integration.name,
          config: integration.config,
          createdAt: integration.createdAt,
          updatedAt: integration.updatedAt,
        })),
        dashboards: dashboardsOut,
      },
    });
  }

  async function buildPlan(
    userId: string,
    rawFile: unknown,
    mode: ImportMode,
  ): Promise<{ plan: ImportPlan; summary: ImportSummary }> {
    // Throws ExportFormatError for malformed/unsupported/invalid files — no data has
    // been touched at this point, satisfying "validate the full file before changing data".
    const file = migrateExportPayload(rawFile);

    const existingDashboardSlugs =
      mode === "merge"
        ? new Set((await repos.dashboards.listByOwner(userId)).map((record) => record.slug))
        : new Set<string>();

    return planImport({
      userId,
      file,
      mode,
      existingDashboardSlugs,
      now: nowEpochMillis(),
    });
  }

  return {
    exportConfig,

    async previewImport(userId, rawFile, mode) {
      const { summary } = await buildPlan(userId, rawFile, mode);
      return summary;
    },

    async runImport(userId, rawFile, mode) {
      const { plan, summary } = await buildPlan(userId, rawFile, mode);

      try {
        db.transaction((tx) => {
          if (mode === "replace") {
            tx.delete(dashboards).where(eq(dashboards.ownerUserId, userId)).run();
            tx.delete(integrations).where(eq(integrations.userId, userId)).run();
            tx.delete(todoItems).where(eq(todoItems.ownerUserId, userId)).run();
            tx.delete(settings)
              .where(and(eq(settings.userId, userId), eq(settings.key, THEME_SETTINGS_KEY)))
              .run();
          }

          for (const row of plan.integrationsToInsert) {
            tx.insert(integrations).values(row).run();
          }
          for (const row of plan.dashboardsToInsert) {
            tx.insert(dashboards).values(row).run();
          }
          for (const row of plan.pagesToInsert) {
            tx.insert(pages).values(row).run();
          }
          for (const row of plan.pageLayoutsToInsert) {
            tx.insert(pageLayouts).values(row).run();
          }
          for (const row of plan.todosToInsert) {
            tx.insert(todoItems).values(row).run();
          }
          if (plan.themeSettingRow) {
            tx.insert(settings).values(plan.themeSettingRow).run();
          }
        });
      } catch {
        throw new BackupServiceError(
          "import_failed",
          "Import failed and was rolled back; no changes were made.",
        );
      }

      return summary;
    },
  };
}
