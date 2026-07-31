import {
  type CreatePageWidgetRequest,
  type CreatePageWidgetResponse,
  DEFAULT_DASHBOARD_NAME,
  DEFAULT_DASHBOARD_PAGES,
  DEFAULT_DASHBOARD_SLUG,
  type Dashboard,
  type DashboardThemeOverride,
  type Page,
  type PageIcon,
  type PageLayoutDocument,
  type PageLayoutResponse,
  type PageWidget,
  addWidgetToLayout,
  createDashoraUuid,
  createDefaultPageLayout,
  pageIconSchema,
  pageLayoutDocumentSchema,
  parseStoredDashboardThemeOverride,
} from "@dashora/shared";
import type { DashboardRecord } from "../db/repositories/dashboards.js";
import type { Repositories } from "../db/repositories/index.js";
import type { PageRecord } from "../db/repositories/pages.js";

function readThemeOverride(record: DashboardRecord): DashboardThemeOverride | null {
  if (!record.themeJson) {
    return null;
  }
  try {
    return parseStoredDashboardThemeOverride(JSON.parse(record.themeJson) as unknown);
  } catch {
    return null;
  }
}

export function toPageDto(record: PageRecord): Page {
  const iconParsed = pageIconSchema.safeParse(record.icon);
  return {
    id: record.id,
    dashboardId: record.dashboardId,
    name: record.title,
    slug: record.slug,
    icon: iconParsed.success ? iconParsed.data : "grid",
    accent: record.accent,
    sortOrder: record.sortOrder,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export function toDashboardDto(record: DashboardRecord, pageRecords: PageRecord[]): Dashboard {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    pages: pageRecords.map(toPageDto),
    themeOverride: readThemeOverride(record),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export type DashboardService = {
  /** Returns the owner's default dashboard, creating defaults when missing. */
  getOrCreateDefaultDashboard: (ownerUserId: string) => Promise<Dashboard>;
  updateThemeOverride: (
    ownerUserId: string,
    themeOverride: DashboardThemeOverride | null,
  ) => Promise<DashboardThemeOverride | null>;
  createPage: (
    ownerUserId: string,
    input: { name: string; slug: string; icon: PageIcon; accent?: string | null },
  ) => Promise<Page>;
  updatePage: (
    ownerUserId: string,
    pageId: string,
    input: {
      name?: string;
      slug?: string;
      icon?: PageIcon;
      accent?: string | null;
    },
  ) => Promise<Page>;
  duplicatePage: (ownerUserId: string, pageId: string) => Promise<Page>;
  reorderPages: (ownerUserId: string, orderedIds: string[]) => Promise<Page[]>;
  deletePage: (ownerUserId: string, pageId: string) => Promise<{ deletedId: string }>;
  getPageLayout: (ownerUserId: string, pageId: string) => Promise<PageLayoutResponse>;
  savePageLayout: (
    ownerUserId: string,
    pageId: string,
    layout: PageLayoutDocument,
  ) => Promise<PageLayoutResponse>;
  resetPageLayout: (ownerUserId: string, pageId: string) => Promise<PageLayoutResponse>;
  createWidget: (
    ownerUserId: string,
    pageId: string,
    input: CreatePageWidgetRequest,
  ) => Promise<CreatePageWidgetResponse>;
};

export type DashboardServiceErrorCode =
  | "not_found"
  | "slug_conflict"
  | "last_page"
  | "invalid_order"
  | "forbidden";

export class DashboardServiceError extends Error {
  readonly code: DashboardServiceErrorCode;

  constructor(code: DashboardServiceErrorCode, message: string) {
    super(message);
    this.name = "DashboardServiceError";
    this.code = code;
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const message =
    "message" in error && typeof error.message === "string" ? error.message : String(error);
  return message.includes("UNIQUE constraint failed") || message.includes("pages_dashboard_slug");
}

export function createDashboardService(repos: Repositories): DashboardService {
  async function requireOwnedDashboard(
    ownerUserId: string,
  ): Promise<{ dashboard: DashboardRecord; pages: PageRecord[] }> {
    const dashboard = await ensureDefaultDashboardRecord(ownerUserId);
    const pageRecords = await repos.pages.listByDashboard(dashboard.id);
    return { dashboard, pages: pageRecords };
  }

  async function requireOwnedPage(
    ownerUserId: string,
    pageId: string,
  ): Promise<{ dashboard: DashboardRecord; page: PageRecord; pages: PageRecord[] }> {
    const { dashboard, pages: pageRecords } = await requireOwnedDashboard(ownerUserId);
    const page = pageRecords.find((candidate) => candidate.id === pageId);
    if (!page) {
      throw new DashboardServiceError("not_found", "Page not found");
    }
    return { dashboard, page, pages: pageRecords };
  }

  async function ensureDefaultDashboardRecord(ownerUserId: string): Promise<DashboardRecord> {
    const existing = await repos.dashboards.findByOwnerAndSlug(ownerUserId, DEFAULT_DASHBOARD_SLUG);
    if (existing) {
      const pageCount = await repos.pages.countByDashboard(existing.id);
      if (pageCount === 0) {
        await seedDefaultPages(existing.id);
      }
      return existing;
    }

    const owned = await repos.dashboards.listByOwner(ownerUserId);
    if (owned[0]) {
      const pageCount = await repos.pages.countByDashboard(owned[0].id);
      if (pageCount === 0) {
        await seedDefaultPages(owned[0].id);
      }
      return owned[0];
    }

    const dashboard = await repos.dashboards.create({
      ownerUserId,
      name: DEFAULT_DASHBOARD_NAME,
      slug: DEFAULT_DASHBOARD_SLUG,
    });
    await seedDefaultPages(dashboard.id);
    return dashboard;
  }

  async function seedDefaultPages(dashboardId: string): Promise<void> {
    for (const [index, page] of DEFAULT_DASHBOARD_PAGES.entries()) {
      await repos.pages.create({
        dashboardId,
        title: page.name,
        slug: page.slug,
        icon: page.icon,
        accent: null,
        sortOrder: index,
      });
    }
  }

  async function allocateUniqueSlug(dashboardId: string, baseSlug: string): Promise<string> {
    const normalized = baseSlug.slice(0, 64);
    let candidate = normalized;
    let suffix = 2;
    while (await repos.pages.findByDashboardAndSlug(dashboardId, candidate)) {
      const suffixText = `-${suffix}`;
      candidate = `${normalized.slice(0, Math.max(1, 64 - suffixText.length))}${suffixText}`;
      suffix += 1;
    }
    return candidate;
  }

  return {
    async getOrCreateDefaultDashboard(ownerUserId) {
      const { dashboard, pages: pageRecords } = await requireOwnedDashboard(ownerUserId);
      return toDashboardDto(dashboard, pageRecords);
    },

    async updateThemeOverride(ownerUserId, themeOverride) {
      const { dashboard } = await requireOwnedDashboard(ownerUserId);
      const themeJson = themeOverride === null ? null : JSON.stringify(themeOverride);
      const updated = await repos.dashboards.update(dashboard.id, { themeJson });
      if (!updated) {
        throw new DashboardServiceError("not_found", "Dashboard not found");
      }
      return readThemeOverride(updated);
    },

    async createPage(ownerUserId, input) {
      const { dashboard } = await requireOwnedDashboard(ownerUserId);
      const existing = await repos.pages.findByDashboardAndSlug(dashboard.id, input.slug);
      if (existing) {
        throw new DashboardServiceError("slug_conflict", "A page with this slug already exists");
      }
      const maxOrder = await repos.pages.getMaxSortOrder(dashboard.id);
      try {
        const created = await repos.pages.create({
          dashboardId: dashboard.id,
          title: input.name,
          slug: input.slug,
          icon: input.icon,
          accent: input.accent ?? null,
          sortOrder: maxOrder + 1,
        });
        return toPageDto(created);
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          throw new DashboardServiceError("slug_conflict", "A page with this slug already exists");
        }
        throw error;
      }
    },

    async updatePage(ownerUserId, pageId, input) {
      const { dashboard, page } = await requireOwnedPage(ownerUserId, pageId);
      if (input.slug !== undefined && input.slug !== page.slug) {
        const conflict = await repos.pages.findByDashboardAndSlug(dashboard.id, input.slug);
        if (conflict && conflict.id !== page.id) {
          throw new DashboardServiceError("slug_conflict", "A page with this slug already exists");
        }
      }
      try {
        const updated = await repos.pages.update(pageId, {
          ...(input.name !== undefined ? { title: input.name } : {}),
          ...(input.slug !== undefined ? { slug: input.slug } : {}),
          ...(input.icon !== undefined ? { icon: input.icon } : {}),
          ...(input.accent !== undefined ? { accent: input.accent } : {}),
        });
        if (!updated) {
          throw new DashboardServiceError("not_found", "Page not found");
        }
        return toPageDto(updated);
      } catch (error) {
        if (error instanceof DashboardServiceError) {
          throw error;
        }
        if (isUniqueConstraintError(error)) {
          throw new DashboardServiceError("slug_conflict", "A page with this slug already exists");
        }
        throw error;
      }
    },

    async duplicatePage(ownerUserId, pageId) {
      const { dashboard, page } = await requireOwnedPage(ownerUserId, pageId);
      const slug = await allocateUniqueSlug(dashboard.id, `${page.slug}-copy`);
      const maxOrder = await repos.pages.getMaxSortOrder(dashboard.id);
      const created = await repos.pages.create({
        dashboardId: dashboard.id,
        title: `${page.title} copy`,
        slug,
        icon: page.icon,
        accent: page.accent,
        sortOrder: maxOrder + 1,
      });
      return toPageDto(created);
    },

    async reorderPages(ownerUserId, orderedIds) {
      const { dashboard, pages: pageRecords } = await requireOwnedDashboard(ownerUserId);
      const existingIds = new Set(pageRecords.map((page) => page.id));
      if (
        orderedIds.length !== existingIds.size ||
        orderedIds.some((id) => !existingIds.has(id)) ||
        new Set(orderedIds).size !== orderedIds.length
      ) {
        throw new DashboardServiceError(
          "invalid_order",
          "orderedIds must list every page on the dashboard exactly once",
        );
      }
      try {
        const reordered = await repos.pages.reorder(dashboard.id, orderedIds);
        return reordered.map(toPageDto);
      } catch {
        throw new DashboardServiceError(
          "invalid_order",
          "orderedIds must list every page on the dashboard exactly once",
        );
      }
    },

    async deletePage(ownerUserId, pageId) {
      const { pages: pageRecords } = await requireOwnedPage(ownerUserId, pageId);
      if (pageRecords.length <= 1) {
        throw new DashboardServiceError("last_page", "Cannot delete the last page on a dashboard");
      }
      const deleted = await repos.pages.deleteById(pageId);
      if (!deleted) {
        throw new DashboardServiceError("not_found", "Page not found");
      }
      return { deletedId: pageId };
    },

    async getPageLayout(ownerUserId, pageId) {
      await requireOwnedPage(ownerUserId, pageId);
      const stored = await repos.pageLayouts.findByPageId(pageId);
      if (!stored) {
        return {
          pageId,
          layout: createDefaultPageLayout(),
          updatedAt: 0,
          isDefault: true,
        };
      }
      return {
        pageId,
        layout: stored.layout,
        updatedAt: stored.updatedAt,
        isDefault: false,
      };
    },

    async savePageLayout(ownerUserId, pageId, layout) {
      await requireOwnedPage(ownerUserId, pageId);
      const parsed = pageLayoutDocumentSchema.parse(layout);
      const stored = await repos.pageLayouts.upsertForPage(pageId, parsed);
      return {
        pageId,
        layout: stored.layout,
        updatedAt: stored.updatedAt,
        isDefault: false,
      };
    },

    async resetPageLayout(ownerUserId, pageId) {
      await requireOwnedPage(ownerUserId, pageId);
      const layout = createDefaultPageLayout();
      const stored = await repos.pageLayouts.upsertForPage(pageId, layout);
      return {
        pageId,
        layout: stored.layout,
        updatedAt: stored.updatedAt,
        isDefault: false,
      };
    },

    async createWidget(ownerUserId, pageId, input) {
      await requireOwnedPage(ownerUserId, pageId);
      const storedLayout = await repos.pageLayouts.findByPageId(pageId);
      const currentLayout = storedLayout?.layout ?? createDefaultPageLayout();
      const instanceId = createDashoraUuid();

      let widget: PageWidget;
      if (input.kind === "widget") {
        widget = {
          kind: "widget",
          id: instanceId,
          type: input.type,
          title: input.title ?? input.type,
          enabled: input.enabled ?? true,
          refreshIntervalSeconds: input.refreshIntervalSeconds ?? null,
          config: structuredClone(input.config ?? {}),
          schemaVersion: input.schemaVersion ?? 1,
          lastUpdatedAt: null,
        };
      } else {
        widget = {
          kind: "placeholder",
          id: instanceId,
          title: input.title,
          description: input.description ?? "",
          tone: input.tone ?? "default",
          enabled: input.enabled ?? true,
          refreshIntervalSeconds: input.refreshIntervalSeconds ?? null,
          lastUpdatedAt: null,
        };
      }

      const next = addWidgetToLayout(currentLayout, widget, input.defaultLayout);
      const stored = await repos.pageLayouts.upsertForPage(pageId, next);
      const created = stored.layout.widgets.find((entry) => entry.id === instanceId);
      if (!created) {
        throw new Error("Failed to persist created widget");
      }

      return {
        pageId,
        widget: created,
        layout: stored.layout,
        updatedAt: stored.updatedAt,
      };
    },
  };
}
