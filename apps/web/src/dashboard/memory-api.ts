import {
  type CreatePageRequest,
  DEFAULT_DASHBOARD_NAME,
  DEFAULT_DASHBOARD_PAGES,
  DEFAULT_DASHBOARD_SLUG,
  type Dashboard,
  type Page,
  type PageLayoutDocument,
  type PageLayoutResponse,
  type UpdatePageRequest,
  clonePageLayout,
  createDefaultPageLayout,
  pageLayoutDocumentSchema,
} from "@dashora/shared";
import type { DashboardApi } from "./api.js";
import { DashboardApiError } from "./api.js";

function now(): number {
  return Date.now();
}

function createDefaultDashboard(): Dashboard {
  const createdAt = now();
  const dashboardId = "11111111-1111-4111-8111-111111111111";
  return {
    id: dashboardId,
    name: DEFAULT_DASHBOARD_NAME,
    slug: DEFAULT_DASHBOARD_SLUG,
    themeOverride: null,
    createdAt,
    updatedAt: createdAt,
    pages: DEFAULT_DASHBOARD_PAGES.map((page, index) => ({
      id: `22222222-2222-4222-8222-${String(index + 1).padStart(12, "0")}`,
      dashboardId,
      name: page.name,
      slug: page.slug,
      icon: page.icon,
      accent: null,
      sortOrder: index,
      createdAt,
      updatedAt: createdAt,
    })),
  };
}

/** In-memory dashboard API for unit tests and offline shell demos. */
export function createMemoryDashboardApi(
  initial: Dashboard = createDefaultDashboard(),
): DashboardApi {
  let dashboard: Dashboard = structuredClone(initial);
  const layouts = new Map<string, { layout: PageLayoutDocument; updatedAt: number }>();

  function requirePage(pageId: string): Page {
    const page = dashboard.pages.find((candidate) => candidate.id === pageId);
    if (!page) {
      throw new DashboardApiError(404, "not_found", "Page not found");
    }
    return page;
  }

  function layoutResponse(pageId: string): PageLayoutResponse {
    const stored = layouts.get(pageId);
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
      layout: clonePageLayout(stored.layout),
      updatedAt: stored.updatedAt,
      isDefault: false,
    };
  }

  return {
    async getDashboard() {
      return structuredClone(dashboard);
    },

    async createPage(input: CreatePageRequest) {
      if (dashboard.pages.some((page) => page.slug === input.slug)) {
        throw new DashboardApiError(409, "slug_conflict", "A page with this slug already exists");
      }
      const createdAt = now();
      const page: Page = {
        id: crypto.randomUUID(),
        dashboardId: dashboard.id,
        name: input.name,
        slug: input.slug,
        icon: input.icon,
        accent: input.accent ?? null,
        sortOrder: dashboard.pages.length,
        createdAt,
        updatedAt: createdAt,
      };
      dashboard = {
        ...dashboard,
        pages: [...dashboard.pages, page],
        updatedAt: createdAt,
      };
      return structuredClone(page);
    },

    async updatePage(pageId, input: UpdatePageRequest) {
      const current = requirePage(pageId);
      if (
        input.slug !== undefined &&
        dashboard.pages.some((page) => page.slug === input.slug && page.id !== pageId)
      ) {
        throw new DashboardApiError(409, "slug_conflict", "A page with this slug already exists");
      }
      const updated: Page = {
        ...current,
        name: input.name ?? current.name,
        slug: input.slug ?? current.slug,
        icon: input.icon ?? current.icon,
        accent: input.accent !== undefined ? (input.accent ?? null) : current.accent,
        updatedAt: now(),
      };
      dashboard = {
        ...dashboard,
        pages: dashboard.pages.map((page) => (page.id === pageId ? updated : page)),
        updatedAt: updated.updatedAt,
      };
      return structuredClone(updated);
    },

    async duplicatePage(pageId) {
      const current = requirePage(pageId);
      let slug = `${current.slug}-copy`;
      let suffix = 2;
      while (dashboard.pages.some((page) => page.slug === slug)) {
        slug = `${current.slug}-copy-${suffix}`;
        suffix += 1;
      }
      const createdAt = now();
      const page: Page = {
        id: crypto.randomUUID(),
        dashboardId: dashboard.id,
        name: `${current.name} copy`,
        slug,
        icon: current.icon,
        accent: current.accent,
        sortOrder: dashboard.pages.length,
        createdAt,
        updatedAt: createdAt,
      };
      dashboard = {
        ...dashboard,
        pages: [...dashboard.pages, page],
        updatedAt: createdAt,
      };
      const sourceLayout = layouts.get(pageId);
      if (sourceLayout) {
        layouts.set(page.id, {
          layout: clonePageLayout(sourceLayout.layout),
          updatedAt: createdAt,
        });
      }
      return structuredClone(page);
    },

    async reorderPages(orderedIds) {
      const byId = new Map(dashboard.pages.map((page) => [page.id, page]));
      if (
        orderedIds.length !== dashboard.pages.length ||
        orderedIds.some((id) => !byId.has(id)) ||
        new Set(orderedIds).size !== orderedIds.length
      ) {
        throw new DashboardApiError(400, "invalid_order", "Invalid page order");
      }
      const updatedAt = now();
      dashboard = {
        ...dashboard,
        updatedAt,
        pages: orderedIds.map((id, index) => {
          const page = byId.get(id);
          if (!page) {
            throw new DashboardApiError(400, "invalid_order", "Invalid page order");
          }
          return { ...page, sortOrder: index, updatedAt };
        }),
      };
      return structuredClone(dashboard);
    },

    async deletePage(pageId) {
      requirePage(pageId);
      if (dashboard.pages.length <= 1) {
        throw new DashboardApiError(409, "last_page", "Cannot delete the last page on a dashboard");
      }
      dashboard = {
        ...dashboard,
        pages: dashboard.pages.filter((page) => page.id !== pageId),
        updatedAt: now(),
      };
      layouts.delete(pageId);
      return { deletedId: pageId };
    },

    async getPageLayout(pageId) {
      requirePage(pageId);
      return layoutResponse(pageId);
    },

    async savePageLayout(pageId, layout) {
      requirePage(pageId);
      const parsed = pageLayoutDocumentSchema.parse(layout);
      const updatedAt = now();
      layouts.set(pageId, { layout: clonePageLayout(parsed), updatedAt });
      return layoutResponse(pageId);
    },

    async resetPageLayout(pageId) {
      requirePage(pageId);
      const updatedAt = now();
      layouts.set(pageId, { layout: createDefaultPageLayout(), updatedAt });
      return layoutResponse(pageId);
    },
  };
}
